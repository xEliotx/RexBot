import { SlashCommandBuilder } from "discord.js";
import { buildDinoRolesMessage } from "./dinoRoles.js";
import { ChannelScope } from "../guards/channels.js";

export default {
  scope: ChannelScope.ANY,

  data: new SlashCommandBuilder()
    .setName("dino-roles")
    .setDescription("Create or update the dinosaur roles panel"),

  async execute(interaction, ctx) {
    const channelId = ctx.config.channels.dinoRolesChannelId;
    if (!channelId) {
      await interaction.reply({
        content: "DINO_ROLES_CHANNEL_ID is not set.",
        ephemeral: true,
      });
      return;
    }

    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({
        content: "Invalid roles channel.",
        ephemeral: true,
      });
      return;
    }

    const payload = buildDinoRolesMessage(interaction.guild);

    let message = null;
    const existingMessageId = ctx.config.channels.dinoRolesMessageId;

    if (existingMessageId) {
      message = await channel.messages.fetch(existingMessageId).catch(() => null);

      if (message) {
        await message.edit(payload);

        await interaction.reply({
          content: "✅ Dino roles panel updated.",
          ephemeral: true,
        });
        return;
      }
    }

    message = await channel.send(payload);

    await interaction.reply({
      content:
        `✅ Dino roles panel created.\n\n` +
        `Add this to your .env:\n` +
        `\`\`\`\nDINO_ROLES_MESSAGE_ID=${message.id}\n\`\`\``,
      ephemeral: true,
    });
  },
};