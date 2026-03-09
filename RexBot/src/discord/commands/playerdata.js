import { SlashCommandBuilder } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { ChannelScope } from "../guards/channels.js";

export const playerdata = {
    scope: ChannelScope.ANY,
    data: new SlashCommandBuilder()
        .setName("playerdata")
        .setDescription("Show raw playerdata for a Steam ID")
        .addStringOption((option) =>
            option
                .setName("steamid")
                .setDescription("Steam64 ID")
                .setRequired(true)
        ),

    async execute(interaction, { rcon }) {
        await interaction.deferReply(EPHEMERAL);

        try {
            const steamId = interaction.options.getString("steamid", true);
            const result = await rcon.sendCommand("playerdata", steamId);

            await interaction.editReply({
                content: `\`\`\`\n${String(result).slice(0, 1900)}\n\`\`\``,
            });
        } catch (err) {
            console.error("playerdata error:", err);

            await interaction.editReply({
                content: `Error: ${err.message}`,
            });
        }
    },
};