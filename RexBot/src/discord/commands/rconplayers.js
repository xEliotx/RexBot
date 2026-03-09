import { SlashCommandBuilder } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { ChannelScope } from "../guards/channels.js";

export const rconplayers = {
    scope: ChannelScope.ANY,
    data: new SlashCommandBuilder()
        .setName("rconplayers")
        .setDescription("Show raw RCON players output"),

    async execute(interaction, { rcon }) {
        await interaction.deferReply(EPHEMERAL);

        try {
            const result = await rcon.sendCommand("players");

            await interaction.editReply({
                content: `\`\`\`\n${String(result).slice(0, 1900)}\n\`\`\``,
            });
        } catch (error) {
            console.error("rconplayers error:", error);

            await interaction.editReply({
                content: `Error: ${error.message}`,
            });
        }
    },
};