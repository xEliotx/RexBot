import { SlashCommandBuilder } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { ChannelScope } from "../guards/channels.js";
import EvrimaRconClient from "../../rcon/rconClient.js";
import { config } from "../../config.js";

export const rconplayers = {
    scope: ChannelScope.ANY,
    data: new SlashCommandBuilder()
        .setName("rconplayers")
        .setDescription("Show raw RCON players output"),

    async execute(interaction) {
        try {
            const rcon = new EvrimaRconClient({
                host: config.rcon.host,
                port: config.rcon.port,
                password: config.rcon.password,
                logger: console,
            });

            const result = await rcon.sendCommand("playerdata", "76561198121969588");
            await interaction.reply({
                content: `\`\`\`\n${String(result).slice(0, 1900)}\n\`\`\``,
                ...EPHEMERAL,
            });

            rcon.disconnect();
        } catch (error) {
            console.error("rconplayers error:", error);

            await interaction.reply({
                content: `Error: ${error.message}`,
                ...EPHEMERAL,
            });
        }
    },
};