import { SlashCommandBuilder } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { ChannelScope } from "../guards/channels.js";

export const ping = {
  scope: ChannelScope.ANY,
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Health check."),

  async execute(interaction) {
    await interaction.reply({ content: "Pong ✅", ...EPHEMERAL });
  },
};
