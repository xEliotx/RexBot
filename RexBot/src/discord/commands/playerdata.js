import { SlashCommandBuilder } from "discord.js";
import { ChannelScope } from "../guards/channels.js";
import { requireAdmin } from "../guards/permissions.js";
import { EPHEMERAL } from "../util/ephemeral.js";

function trimToDiscord(content, max = 1900) {
  const text = String(content ?? "").trim();
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

export const playerdata = {
  scope: ChannelScope.ADMIN,
  data: new SlashCommandBuilder()
    .setName("playerdata")
    .setDescription("Fetch raw player data from Evrima RCON (admin only).")
    .addStringOption((opt) =>
      opt
        .setName("player_id")
        .setDescription("The player identifier (SteamID / EOS / whatever your server expects).")
        .setRequired(true)
    ),

  async execute(interaction, ctx) {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    const playerId = interaction.options.getString("player_id", true).trim();
    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    try {
      await ctx.rcon.connect();
      const raw = await ctx.rcon.sendCommand("playerdata", playerId);
      const safe = trimToDiscord(raw);
      await interaction.editReply({ content: `\`\`\`\n${safe}\n\`\`\`` }).catch(() => {});
    } catch (e) {
      await interaction
        .editReply({ content: `Failed to fetch playerdata: ${e?.message ?? e}` })
        .catch(() => {});
    }
  },
};
