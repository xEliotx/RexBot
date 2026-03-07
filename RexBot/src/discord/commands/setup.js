import { SlashCommandBuilder } from "discord.js";
import { ChannelScope, requireChannel } from "../guards/channels.js";
import { requireAdmin } from "../guards/permissions.js";
import { buildAdminModerationPanel, buildAdminTokenPanel, buildLinkPanel, buildTokenPanel } from "../ui/panels.js";
import { EPHEMERAL } from "../util/ephemeral.js";

export const setup = {
  scope: ChannelScope.ADMIN, // must run in admin channel
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Posts the bot panels into the configured channels (admin only)."),

  async execute(interaction, ctx) {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;
    if (!(await requireChannel(interaction, ChannelScope.ADMIN, ctx.config.channels))) return;

    // Avoid the 3s interaction timeout while we fetch channels + post panels
    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({ content: "This must be used in a server." }).catch(() => {});
      return;
    }

        const fetchCh = async (id, label) => {
      try {
        const ch = await guild.channels.fetch(id);
        return { ch, err: null };
      } catch (err) {
        return { ch: null, err, label, id };
      }
    };

    const adminRes = await fetchCh(ctx.config.channels.adminChannelId, "Admin");
    const linkRes = await fetchCh(ctx.config.channels.linkChannelId, "Link");
    const tokenRes = await fetchCh(ctx.config.channels.tokensChannelId, "Tokens");

    const fetchErrors = [adminRes, linkRes, tokenRes].filter((r) => r.err);
    if (fetchErrors.length) {
      const lines = fetchErrors.map((r) => {
        const code = r.err?.code;
        const msg = r.err?.message ?? String(r.err);
        if (code === 50001) return `• ${r.label} channel (${r.id}): **Missing Access** (bot cannot view that channel)`;
        if (code === 50013) return `• ${r.label} channel (${r.id}): **Missing Permissions** (bot can see it but lacks perms to fetch/use it)`;
        return `• ${r.label} channel (${r.id}): ${msg}`;
      });

      await interaction
        .editReply({
          content: `I couldn't access one or more configured channels. Check:
• The channel IDs are correct and belong to this server
• The bot has **View Channel** permission in those channels
• Channel permission overrides aren't denying the bot

${lines.join("\n")}`,
        })
        .catch(() => {});
      return;
    }

    const adminCh = adminRes.ch;
    const linkCh = linkRes.ch;
    const tokensCh = tokenRes.ch;


    const badType = [
      ["Admin", adminCh],
      ["Link", linkCh],
      ["Tokens", tokensCh],
    ].find(([, ch]) => !ch.isTextBased?.() || typeof ch.send !== "function");

    if (badType) {
      await interaction.editReply({
        content: `${badType[0]} channel (<#${badType[1].id}>) is not a text channel I can post in. Please set the correct channel ID in your .env.`,
      }).catch(() => {});
      return;
    }

        const post = async (label, ch, payload) => {
      try {
        await ch.send(payload);
        return null;
      } catch (err) {
        const code = err?.code;
        const msg = err?.message ?? String(err);
        if (code === 50001) return `• ${label} (<#${ch.id}>): **Missing Access**`;
        if (code === 50013) return `• ${label} (<#${ch.id}>): **Missing Permissions**`;
        return `• ${label} (<#${ch.id}>): ${msg}`;
      }
    };

    const errors = [];
    const e1 = await post("Admin panel", adminCh, buildAdminModerationPanel());
    if (e1) errors.push(e1);
    const e1b = await post("Admin token panel", adminCh, buildAdminTokenPanel());
    if (e1b) errors.push(e1b);
    const e2 = await post("Steam link panel", linkCh, buildLinkPanel(guild));
    if (e2) errors.push(e2);
    const e3 = await post("Tokens panel", tokensCh, buildTokenPanel(guild));
    if (e3) errors.push(e3);

    if (errors.length) {
      await interaction
        .editReply({
          content: `Failed to post one or more panels. Make sure the bot has **View Channel** + **Send Messages** (and **Embed Links** for embeds) in the target channels.

${errors.join("\n")}`,
        })
        .catch(() => {});
      return;
    }



    await interaction.editReply({ content: "Panels posted ✅" }).catch(() => {});
  },
};
