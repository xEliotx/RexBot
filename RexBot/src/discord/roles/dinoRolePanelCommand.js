import { buildDinoRolesMessage } from "./dinoRoles.js";

export default {
  data: {
    name: "dino-roles",
    description: "Create or update the dinosaur roles panel",
  },

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

    let message;

    if (ctx.config.channels.dinoRolesMessageId) {
      // Try edit existing
      message = await channel.messages
        .fetch(ctx.config.channels.dinoRolesMessageId)
        .catch(() => null);

      if (message) {
        await message.edit(payload);

        await interaction.reply({
          content: "✅ Dino roles panel updated.",
          ephemeral: true,
        });
        return;
      }
    }

    // Create new panel
    message = await channel.send(payload);

    await interaction.reply({
      content: `✅ Panel created.\n\nNow copy this ID into your .env:\n\`\`\`\nDINO_ROLES_MESSAGE_ID=${message.id}\n\`\`\``,
      ephemeral: true,
    });
  },
};