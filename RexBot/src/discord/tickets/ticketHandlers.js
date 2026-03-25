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
    return type
        .replace(/_/g, "")
        .toLowerCase();
}

export async function handleTicketButton(interaction, ctx) {
    const { config, logger } = ctx;

    // ticket:create

    //const staffRoleId = isAdminReport
    //  ? config.roles.adminReportRoleId   // 🔒 restricted staff
    //: (config.channels.ticketStaffRoleId || config.roles.adminRoleId);

    if (interaction.customId === "ticket:create") {
        await interaction.deferReply({ ...EPHEMERAL });

        const guild = interaction.guild;
        if (!guild) return;

        const selectedType = interaction.values?.[0];
        const categoryId = config.channels.ticketCategoryId;
        const isAdminReport = selectedType === "admin_report";
        const extraLine =
            selectedType === "admin_report"
                ? "_This ticket is restricted to senior staff only._"
                : null;


        const staffRoleId = isAdminReport
            ? config.roles.adminReportRoleId        // 🔒 restricted staff
            : (config.channels.ticketStaffRoleId || config.roles.adminRoleId);


        // Prevent duplicate tickets (simple: check existing channels for topic marker)
        const existing = guild.channels.cache.find(
            (c) =>
                c.type === ChannelType.GuildText &&
                c.parentId === categoryId &&
                c.topic?.includes(`ticket_owner=${interaction.user.id}`)
        );

        if (existing) {
            await interaction.editReply({
                content: `You already have an open ticket: <#${existing.id}>`,
            });
            return;
        }

        let counts = await loadTicketCounts();
        const userId = interaction.user.id;

        let nextNum = (counts[userId] ?? 0) + 1;
        counts[userId] = nextNum;


        // Save immediately so it doesn’t repeat if something crashes mid-create
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
                    // @everyone
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },

                    // ticket owner
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },

                    // staff OR admin-report staff
                    {
                        id: staffRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages,
                        ],
                    },

                    // bot
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

            const typeLabels = {
                ingame_support: "🎮 Ingame Support",
                report_player: "🚨 Player Report",
                discord_support: "💬 Discord Support",
                admin_report: "🛑 Admin Report",
                other: "❓ Other",
            };

            const prettyType = typeLabels[selectedType] ?? "Support Ticket";
            const embed = new EmbedBuilder()
                .setColor(0xff0033)
                .setTitle(prettyType)
                .setDescription(
                    [
                        `Hey <@${interaction.user.id}> — staff will be with you shortly.`,
                        extraLine,
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

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ticket:close")
                    .setLabel("Close Ticket")
                    .setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });

            await interaction.editReply({
                content: `✅ Ticket created: <#${channel.id}>`,
            });
        } catch (err) {
            // 🔁 rollback the counter so numbers don't "burn" on failed channel create
            try {
                if (counts && userId && nextNum) {
                    const current = Number(counts[userId] ?? 0);
                    // Only rollback if we are still at the number we just wrote
                    if (current === nextNum) {
                        counts[userId] = Math.max(0, current - 1);
                        await saveTicketCounts(counts);
                    }
                }
            } catch (rollbackErr) {
                logger?.warn?.("Ticket counter rollback failed:", rollbackErr);
            }

            logger?.error?.("Ticket create failed:", err);
            await interaction.editReply({ content: "❌ Failed to create ticket. Check bot permissions." });
        }


        return;
    }
    // ticket:keepopen
    if (interaction.customId === "ticket:keepopen") {
        const ch = interaction.channel;
        const topic = ch?.topic ?? "";

        if (!topic.includes("ticket_owner=")) {
            await interaction.reply({ content: "Not a ticket channel.", flags: MessageFlags.Ephemeral });
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
        await interaction.reply({ content: "✅ Ticket kept open.", flags: MessageFlags.Ephemeral });
        return;
    }

    // ticket:close
    if (interaction.customId === "ticket:close") {
        await interaction.deferReply({ ...EPHEMERAL });

        const channel = interaction.channel;
        if (!channel) return;

        const ownerId = channel.topic?.match(/ticket_owner=(\d+)/)?.[1];
        const staffRoleId = ctx.config.channels.ticketStaffRoleId || ctx.config.roles.adminRoleId;

        const isOwner = ownerId === interaction.user.id;
        const isStaff = interaction.member?.roles?.cache?.has?.(staffRoleId);

        if (!isOwner && !isStaff) {
            await interaction.editReply({ content: "You can’t close this ticket." });
            return;
        }

        await interaction.editReply({ content: "🧹 Saving transcript and closing ticket in 3 seconds…" });

        setTimeout(async () => {
            const details = {
                closureMode: "Manual",
                reason: "Resolved",
                closedBy: `<@${interaction.user.id}>`,
                claimedBy: "Not claimed",
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

    // default
    await interaction.reply({ content: "Unknown ticket action.", ...EPHEMERAL }).catch(() => { });
}
