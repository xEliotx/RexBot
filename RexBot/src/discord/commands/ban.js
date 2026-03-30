import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { ChannelScope } from "../guards/channels.js";
import { loadPunishments, savePunishments } from "../moderation/punishmentsStore.js";
import { updatePlayerRecordEmbed } from "../moderation/updatePlayerRecordEmbed.js";
import { updatePlayerNickname } from "../moderation/updatePlayerNickname.js";
import { ensurePlayerRecord, addHistoryEntry, getTypeCount } from "../moderation/punishmentHelpers.js";

export const ban = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Add a ban to a player record")
        .addUserOption(option =>
            option.setName("user").setDescription("User to ban").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason").setDescription("Reason for the ban").setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    scope: ChannelScope.PLAYER_RECORDS,

    async execute(interaction, ctx) {
        const user = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);

        const data = await loadPunishments();
        const record = ensurePlayerRecord(data, user);

        addHistoryEntry(record, "ban", reason, interaction.user.id);

        await updatePlayerRecordEmbed(
            interaction.guild,
            user,
            record,
            ctx.config.channels.playerRecordsChannelId
        );

        await updatePlayerNickname(interaction.guild, user.id, record);
        await savePunishments(data);

        const totalBans = getTypeCount(record, "ban");

        await interaction.reply({
            content: `⛔ Ban added to ${user.tag}. Total ban entries: ${totalBans}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};