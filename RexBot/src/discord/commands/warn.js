import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { loadPunishments, savePunishments } from "../moderation/punishmentsStore.js";
import { updatePlayerRecordEmbed } from "../moderation/updatePlayerRecordEmbed.js";
import { ensurePlayerRecord, addHistoryEntry, getTypeCount } from "../moderation/punishmentHelpers.js";
import { ChannelScope } from "../guards/channels.js";

export const warn = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Add a warning to a player record")
        .addUserOption(option =>
            option.setName("user").setDescription("User to warn").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason").setDescription("Reason for the warning").setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    scope: ChannelScope.PLAYER_RECORDS,

    async execute(interaction, ctx) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);

        const data = await loadPunishments();
        const record = ensurePlayerRecord(data, user);

        addHistoryEntry(record, "warn", reason, interaction.user.id);

        await updatePlayerRecordEmbed(
            interaction.guild,
            user,
            record,
            ctx.config.channels.playerRecordsChannelId
        );

        await savePunishments(data);

        const totalWarnings = getTypeCount(record, "warn");

        await interaction.reply({
            content: `✅ Warning added to ${user.tag}. Total warnings: ${totalWarnings}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};