import { SlashCommandBuilder } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { ChannelScope } from "../guards/channels.js";

export const poptest = {
  scope: ChannelScope.ANY,
  data: new SlashCommandBuilder()
    .setName("poptest")
    .setDescription("Test command."),

  async execute(interaction) {
    console.log("poptest execute reached");
    await interaction.reply({ content: "poptest works ✅", ...EPHEMERAL });
  },
};