import {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { sendTicketTranscript } from "./ticketTranscript.js";
import { notifyTicketOwnerClosed } from "./ticketNotifications.js";
import { parseTicketTopic, setTopicValue, removeTopicValue } from "./ticketMeta.js";
import { buildTicketPanelMessage } from "./ticketPanelCommand.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const COUNTS_FILE = path.join(DATA_DIR, "ticketCounts.json");

async function loadTicketCounts() {
    try {
        const raw = await readFile(COUNTS_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

async function saveTicketCounts(counts) {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(COUNTS_FILE, JSON.stringify(counts, null, 2), "utf8");
}

function slugUsername(user) {
    return (
        user.username
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 16) || "user"
    );
}

function slugTicketType(type) {
    return type.replace(/_/g, "").toLowerCase();
}

function getTypeLabel(ticketType) {
    const typeLabels = {
        ingame_support: "🎮 Ingame Support",
        report_player: "🚨 Player Report",
        discord_support: "💬 Discord Support",
        admin_report: "🛑 Admin Report",
        other: "❓ Other",
    };

    return typeLabels[ticketType] ?? "Support Ticket";
}

function buildTicketButtons(ticketType, claimedBy = null) {
    const isAdminReport = ticketType === "admin_report";

    if (isAdminReport) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket:close")
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger)
        );
    }

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket:claim")
            .setLabel("Claim Ticket")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(Boolean(claimedBy)),

        new ButtonBuilder()
            .setCustomId("ticket:unclaim")
            .setLabel("Unclaim Ticket")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!claimedBy),

        new ButtonBuilder()
            .setCustomId("ticket:close")
            .setLabel("Close Ticket")
            .setStyle(ButtonStyle.Danger)
    );
}

function buildTicketEmbed({ ownerId, ticketType, claimedBy }) {
    const isAdminReport = ticketType === "admin_report";
    const extraLine = isAdminReport
        ? "_This ticket is restricted to senior staff only._"
        : null;

    const claimedLine = !isAdminReport
        ? `**Claimed By:** ${claimedBy ? `<@${claimedBy}>` : "Not claimed"}`
        : null;

    return new EmbedBuilder()
        .setColor(0xff0033)
        .setTitle(getTypeLabel(ticketType))
        .setDescription(
            [
                `Hey <@${ownerId}> — staff will be with you shortly.`,
                extraLine,
                claimedLine,
                "",
                "**Please include:**",
                "• What you need help with",
                "• Clear description of the issue",
                "• Any relevant screenshots / clips",
                "",
                "• **NOTE: Tickets will automatically close after 24 hours of inactivity**",
            ].filter(Boolean).join("\n")
        )
        .setTimestamp();
}

async function updateTicketPanelMessage(channel) {
    const meta = parseTicketTopic(channel.topic ?? "");
    if (!meta.ticketMessageId) return;

    const message = await channel.messages.fetch(meta.ticketMessageId).catch(() => null);
    if (!message) return;

    const embed = buildTicketEmbed({
        ownerId: meta.ownerId,
        ticketType: meta.ticketType,
        claimedBy: meta.claimedBy,
    });

    const row = buildTicketButtons(meta.ticketType, meta.claimedBy);

    await message.edit({
        embeds: [embed],
        components: [row],
    });
}

function getStaffRoleIdsForTicket(ctx, ticketType) {
    if (ticketType === "admin_report") {
        return [
            ctx.config.roles.ownerRoleId,
        ].filter(Boolean);
    }

    return [
        ctx.config.channels.ticketStaffRoleId,
        ctx.config.roles.moderatorRoleId,
        ctx.config.roles.adminRoleId,
        ctx.config.roles.headAdminRoleId,
        ctx.config.roles.ownerRoleId,
    ].filter(Boolean);
}

export async function handleTicketButton(interaction, ctx) {
    const { config, logger } = ctx;

    if (interaction.customId === "ticket:create") {
        await interaction.deferReply({ ...EPHEMERAL });

        const guild = interaction.guild;
        if (!guild) return;

        const selectedType = interaction.values?.[0];
        const categoryId = config.channels.ticketCategoryId;
        const staffRoleIds = getStaffRoleIdsForTicket(ctx, selectedType);

        const existing = guild.channels.cache.find(
            (c) =>
                c.type === ChannelType.GuildText &&
                c.parentId === categoryId &&
                c.topic?.includes(`ticket_owner=${interaction.user.id}`) &&
                c.topic?.includes(`ticket_type=${selectedType}`)
        );

        if (existing) {
            await interaction.editReply({
                content: `You already have an open ticket of this type: <#${existing.id}>`,
            });
            return;
        }

        let counts = await loadTicketCounts();
        const userId = interaction.user.id;

        const nextNum = (counts[userId] ?? 0) + 1;
        counts[userId] = nextNum;

        await saveTicketCounts(counts);

        const usernameSlug = slugUsername(interaction.user);
        const typeSlug = slugTicketType(selectedType);
        const ticketName = `${usernameSlug}-${typeSlug}-${nextNum}`;

        try {
            const channel = await guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: categoryId,
                topic: `ticket_owner=${userId};ticket_num=${nextNum};ticket_type=${selectedType};last_activity=${Date.now()};warned=0`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                    ...staffRoleIds.map((roleId) => ({
                        id: roleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages,
                        ],
                    })),
                    {
                        id: guild.members.me.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                ],
            });

            const embed = buildTicketEmbed({
                ownerId: interaction.user.id,
                ticketType: selectedType,
                claimedBy: null,
            });

            const row = buildTicketButtons(selectedType, null);

            const ticketMessage = await channel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [embed],
                components: [row],
            });

            const updatedTopic = setTopicValue(channel.topic ?? "", "ticket_message", ticketMessage.id);
            await channel.setTopic(updatedTopic);

            await interaction.editReply({
                content: `✅ Ticket created: <#${channel.id}>`,
            });
            if (interaction.message) {
                await interaction.message.edit(buildTicketPanelMessage(interaction.guild)).catch(() => { });
            }
        } catch (err) {
            try {
                const current = Number(counts[userId] ?? 0);
                if (current === nextNum) {
                    counts[userId] = Math.max(0, current - 1);
                    await saveTicketCounts(counts);
                }
            } catch (rollbackErr) {
                logger?.warn?.("Ticket counter rollback failed:", rollbackErr);
            }

            logger?.error?.("Ticket create failed:", err);
            await interaction.editReply({
                content: "❌ Failed to create ticket. Check bot permissions.",
            });
        }

        return;
    }

    if (interaction.customId === "ticket:keepopen") {
        const ch = interaction.channel;
        const topic = ch?.topic ?? "";

        if (!topic.includes("ticket_owner=")) {
            await interaction.reply({
                content: "Not a ticket channel.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const now = Date.now();
        let newTopic = topic.includes("last_activity=")
            ? topic.replace(/last_activity=\d+/, `last_activity=${now}`)
            : `${topic};last_activity=${now}`;

        newTopic = newTopic.includes("warned=")
            ? newTopic.replace(/warned=\d+/, "warned=0")
            : `${newTopic};warned=0`;

        await ch.setTopic(newTopic).catch(() => { });
        await interaction.reply({
            content: "✅ Ticket kept open.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (interaction.customId === "ticket:claim") {
        await interaction.deferReply({ ...EPHEMERAL });

        const channel = interaction.channel;
        if (!channel) return;

        const meta = parseTicketTopic(channel.topic ?? "");

        if (meta.ticketType === "admin_report") {
            await interaction.editReply({
                content: "Admin reports cannot be claimed.",
            });
            return;
        }

        const staffRoleIds = getStaffRoleIdsForTicket(ctx, meta.ticketType);
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = staffRoleIds.some((roleId) => member.roles.cache.has(roleId));

        if (!isStaff) {
            await interaction.editReply({
                content: "Only staff can claim tickets.",
            });
            return;
        }

        if (meta.claimedBy && meta.claimedBy !== interaction.user.id) {
            await interaction.editReply({
                content: `This ticket is already claimed by <@${meta.claimedBy}>.`,
            });
            return;
        }

        if (meta.claimedBy === interaction.user.id) {
            await interaction.editReply({
                content: "You already claimed this ticket.",
            });
            return;
        }

        const newTopic = setTopicValue(channel.topic ?? "", "claimed_by", interaction.user.id);
        await channel.setTopic(newTopic);
        await updateTicketPanelMessage(channel);

        await channel.send({
            content: `🛠️ This ticket has been claimed by <@${interaction.user.id}>.`,
        });

        await interaction.editReply({
            content: "You claimed this ticket.",
        });

        return;
    }

    if (interaction.customId === "ticket:unclaim") {
        await interaction.deferReply({ ...EPHEMERAL });

        const channel = interaction.channel;
        if (!channel) return;

        const meta = parseTicketTopic(channel.topic ?? "");

        if (meta.ticketType === "admin_report") {
            await interaction.editReply({
                content: "Admin reports cannot be unclaimed.",
            });
            return;
        }

        const staffRoleIds = getStaffRoleIdsForTicket(ctx, meta.ticketType);
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = staffRoleIds.some((roleId) => member.roles.cache.has(roleId));

        if (!isStaff) {
            await interaction.editReply({
                content: "Only staff can unclaim tickets.",
            });
            return;
        }

        if (!meta.claimedBy) {
            await interaction.editReply({
                content: "This ticket is not currently claimed.",
            });
            return;
        }

        if (meta.claimedBy !== interaction.user.id) {
            await interaction.editReply({
                content: `Only the current claimer (<@${meta.claimedBy}>) can unclaim this ticket.`,
            });
            return;
        }

        const newTopic = removeTopicValue(channel.topic ?? "", "claimed_by");
        await channel.setTopic(newTopic);
        await updateTicketPanelMessage(channel);

        await channel.send({
            content: `↩️ This ticket has been unclaimed by <@${interaction.user.id}>.`,
        });

        await interaction.editReply({
            content: "You unclaimed this ticket.",
        });

        return;
    }

    if (interaction.customId === "ticket:close") {
        await interaction.deferReply({ ...EPHEMERAL });

        const channel = interaction.channel;
        if (!channel) return;

        const meta = parseTicketTopic(channel.topic ?? "");
        const staffRoleIds = getStaffRoleIdsForTicket(ctx, meta.ticketType);
        const member = await interaction.guild.members.fetch(interaction.user.id);

        const isStaff = staffRoleIds.some((roleId) => member.roles.cache.has(roleId));

        if (!isStaff) {
            await interaction.editReply({
                content: "Only staff can close this ticket.",
            });
            return;
        }

        await interaction.editReply({
            content: "🧹 Saving transcript and closing ticket in 3 seconds…",
        });

        setTimeout(async () => {
            const details = {
                closureMode: "Manual",
                reason: "Resolved",
                closedBy: `<@${interaction.user.id}>`,
                claimedBy: meta.claimedBy ? `<@${meta.claimedBy}>` : "Not claimed",
            };

            try {
                await sendTicketTranscript(channel, ctx, details);
            } catch (err) {
                ctx.logger?.warn?.("Failed to save ticket transcript:", err);
            }

            try {
                await notifyTicketOwnerClosed(channel, details, ctx);
            } catch (err) {
                ctx.logger?.warn?.("Failed to DM ticket owner:", err);
            }

            try {
                await channel.delete("Ticket closed");
            } catch { }
        }, 3000);

        return;
    }

    await interaction.reply({
        content: "Unknown ticket action.",
        ...EPHEMERAL,
    }).catch(() => { });
}