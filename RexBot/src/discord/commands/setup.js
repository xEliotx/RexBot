import { SlashCommandBuilder } from "discord.js";
import { ChannelScope, requireChannel } from "../guards/channels.js";
import { requireAdmin } from "../guards/permissions.js";
import { EPHEMERAL } from "../util/ephemeral.js";

export const setup = {
  scope: ChannelScope.ADMIN,
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Checks the configured channels and bot permissions (admin only)."),

  async execute(interaction, ctx) {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;
    if (!(await requireChannel(interaction, ChannelScope.ADMIN, ctx.config.channels))) return;

    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({ content: "This must be used in a server." }).catch(() => {});
      return;
    }

    const checks = [
      ["Admin channel", ctx.config.channels.adminChannelId],
      ["Player count channel", ctx.config.channels.playerCountChannelId],
      ["Server status channel", ctx.config.channels.serverStatusChannelId],
      ["Ticket category", ctx.config.channels.ticketCategoryId],
    ].filter(([, id]) => id);

    const lines = [];
    for (const [label, id] of checks) {
      try {
        const ch = await guild.channels.fetch(id);
        lines.push(`✅ ${label}: <#${ch.id}>`);
      } catch (err) {
        lines.push(`❌ ${label} (${id}): ${err?.message ?? err}`);
      }
    }

    await interaction.editReply({
      content: `Setup check complete.\n\n${lines.join("\n")}`,
    }).catch(() => {});
  },
};
