import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from "discord.js";
import { loadPunishments } from "../moderation/punishmentsStore.js";
import { ChannelScope } from "../guards/channels.js";

export const history = {
    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("View a player's moderation history")
        .addUserOption(option =>
            option.setName("user").setDescription("User to look up").setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    scope: ChannelScope.PLAYER_RECORDS,

    async execute(interaction) {
        const user = interaction.options.getUser("user", true);
        const data = await loadPunishments();
        const record = data[user.id];

        if (!record || !record.history.length) {
            await interaction.reply({
                content: `${user.tag} has no moderation history recorded.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const lines = [...record.history]
            .slice(-15)
            .reverse()
            .map((entry) => {
                const ts = Math.floor(new Date(entry.date).getTime() / 1000);
                return `• **${entry.type.toUpperCase()}** — ${entry.reason}\n  <t:${ts}:f> by <@${entry.staffId}>`;
            });

        const embed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setTitle(`History: ${user.tag}`)
            .setDescription(`Discord ID: \`${user.id}\``)
            .addFields({
                name: "Entries",
                value: lines.join("\n\n").slice(0, 1024),
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    },
};