import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from "discord.js";
import { loadPunishments, savePunishments } from "../moderation/punishmentsStore.js";
import { updatePlayerRecordEmbed } from "../moderation/updatePlayerRecordEmbed.js";
import { updatePlayerNickname } from "../moderation/updatePlayerNickname.js";
import { cleanEntries } from "../moderation/punishmentHelpers.js";
import { ChannelScope } from "../guards/channels.js";

export const clean = {
    data: new SlashCommandBuilder()
        .setName("clean")
        .setDescription("Remove moderation history from a player")
        .addUserOption(option =>
            option.setName("user").setDescription("User to clean").setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("type")
                .setDescription("Type of record to remove")
                .setRequired(true)
                .addChoices(
                    { name: "Warn", value: "warn" },
                    { name: "Ban", value: "ban" },
                    { name: "Note", value: "note" },
                    { name: "All", value: "all" },
                )
        )
        .addStringOption(option =>
            option
                .setName("amount")
                .setDescription('How many to remove, or "all"')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    scope: ChannelScope.PLAYER_RECORDS,

    async execute(interaction, ctx) {
        const user = interaction.options.getUser("user", true);
        const type = interaction.options.getString("type", true);
        const amountRaw = interaction.options.getString("amount", true).toLowerCase();

        const amount = amountRaw === "all" ? "all" : Number(amountRaw);

        if (amount !== "all" && (!Number.isFinite(amount) || amount <= 0)) {
            await interaction.reply({
                content: 'Amount must be a positive number or "all".',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const data = await loadPunishments();
        const record = data[user.id];

        if (!record || !record.history.length) {
            await interaction.reply({
                content: `${user.tag} has no moderation history to clean.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const removed = cleanEntries(record, type, amount);

        if (!removed) {
            await interaction.reply({
                content: `No matching ${type} entries were removed for ${user.tag}.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await updatePlayerRecordEmbed(
            interaction.guild,
            user,
            record,
            ctx.config.channels.playerRecordsChannelId
        );

        await updatePlayerNickname(interaction.guild, user.id, record);
        await savePunishments(data);

        await interaction.reply({
            content: `✅ Removed ${removed} ${type} entr${removed === 1 ? "y" : "ies"} from ${user.tag}.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};