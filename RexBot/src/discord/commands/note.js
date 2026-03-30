import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { loadPunishments, savePunishments } from "../moderation/punishmentsStore.js";
import { updatePlayerRecordEmbed } from "../moderation/updatePlayerRecordEmbed.js";
import { ensurePlayerRecord, addHistoryEntry, getTypeCount } from "../moderation/punishmentHelpers.js";
import { ChannelScope } from "../guards/channels.js";

export const note = {
    data: new SlashCommandBuilder()
        .setName("note")
        .setDescription("Add a staff note to a player record")
        .addUserOption(option =>
            option.setName("user").setDescription("User to note").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason").setDescription("Note content").setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    scope: ChannelScope.PLAYER_RECORDS,

    async execute(interaction, ctx) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);

        const data = await loadPunishments();
        const record = ensurePlayerRecord(data, user);

        addHistoryEntry(record, "note", reason, interaction.user.id);

        await updatePlayerRecordEmbed(
            interaction.guild,
            user,
            record,
            ctx.config.channels.playerRecordsChannelId
        );

        await savePunishments(data);

        const totalNotes = getTypeCount(record, "note");

        await interaction.reply({
            content: `✅ Note added to ${user.tag}. Total notes: ${totalNotes}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};