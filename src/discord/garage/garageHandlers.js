import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { EPHEMERAL } from "../util/ephemeral.js";

import { requireAdmin } from "../guards/permissions.js";
import { resolveSteam64ForDiscord, createSnapshotFromAdminInput, createSnapshotFromSafelog, createTokenForSnapshot, listTokensForSteam64, redeemToken, revokeToken, purgeInactiveTokens, getSnapshot } from "../../garage/tokenService.js";
import { parsePlayers } from "../admin/playerParser.js";
import { getLatestSafelogForSteam64 } from "../../ftp/safelog.js";
import { deletePlayerSaveFiles } from "../../ftp/playerSaves.js";

function tokenThumb(ctx) {
  const url = ctx.config.tokens?.imageUrl;
  return url && String(url).trim() ? String(url).trim() : null;
}

export async function handleGarageButton(interaction, ctx) {
  const id = interaction.customId;

  // Admin actions (in admin channel)
  if (id === "garage:admin:create_token") {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    const modal = new ModalBuilder()
      .setCustomId("garage:admin:create_token_modal")
      .setTitle("Create Dino Token");

    const species = new TextInputBuilder()
      .setCustomId("species")
      .setLabel("Dino species (name)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("e.g. Tyrannasaurus");

    const steam64 = new TextInputBuilder()
      .setCustomId("steam64")
      .setLabel("Assign to Steam64 (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("Leave blank for unassigned (giftable)");

    const values = new TextInputBuilder()
      .setCustomId("values")
      .setLabel("Values JSON (growth/skin/hp etc.)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setPlaceholder('{ "growth": 1.0, "hp": 1.0, "skin": "Default" }');

    modal.addComponents(
      new ActionRowBuilder().addComponents(species),
      new ActionRowBuilder().addComponents(steam64),
      new ActionRowBuilder().addComponents(values),
    );

    await interaction.showModal(modal);
    return;
  }

  if (id === "garage:admin:revoke_token") {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    const modal = new ModalBuilder()
      .setCustomId("garage:admin:revoke_token_modal")
      .setTitle("Revoke Token");

    const token = new TextInputBuilder()
      .setCustomId("token")
      .setLabel("Token code")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("e.g. Tyrannasaurus45775");

    modal.addComponents(new ActionRowBuilder().addComponents(token));
    await interaction.showModal(modal);
    return;
  }

  if (id === "garage:admin:purge_inactive_tokens") {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    const modal = new ModalBuilder()
      .setCustomId("garage:admin:purge_inactive_tokens_modal")
      .setTitle("Purge Inactive Tokens");

    const confirm = new TextInputBuilder()
      .setCustomId("confirm")
      .setLabel("Type PURGE to confirm")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("PURGE");

    modal.addComponents(new ActionRowBuilder().addComponents(confirm));
    await interaction.showModal(modal);
    return;
  }

  // Player actions (in tokens channel)
  if (id === "garage:player:store_dino") {
    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    const steam64 = await resolveSteam64ForDiscord(interaction.user.id);
    if (!steam64) {
      await interaction.editReply({ content: "You haven't linked your Steam64 yet. Use the Link panel first." }).catch(() => {});
      return;
    }

    // Must be offline to safely delete save files.
    let raw;
    try {
      raw = await ctx.rcon.sendRaw("playerlist");
    } catch (e) {
      await interaction.editReply({ content: `Couldn't check online status. (${e?.message ?? String(e)})` }).catch(() => {});
      return;
    }

    const players = parsePlayers(raw);
    if (players.some((p) => p.steam64 === steam64)) {
      await interaction.editReply({
        content:
          "You're still online. Please **SafeLog**, fully disconnect, then click **Store Dino** again.\n\n" +
          "(If you just logged out, wait 10–20 seconds for the server to update.)",
      }).catch(() => {});
      return;
    }

    // Read latest SafeLog snapshot from server logs.
    const maxAgeMinutes = Number(ctx.config.tokens?.safelogMaxAgeMinutes ?? 10);
    let safelog;
    try {
      safelog = await getLatestSafelogForSteam64({
        ftpConfig: ctx.config.ftp,
        logsDir: ctx.config.ftp.logsDir,
        steam64,
        maxAgeMinutes,
      });
    } catch (e) {
      await interaction.editReply({ content: `Failed to read server logs. (${e?.message ?? String(e)})` }).catch(() => {});
      return;
    }

    if (!safelog) {
      await interaction.editReply({
        content:
          "No recent SafeLog entry was found for you.\n\n" +
          "Please **SafeLog** on the dino you want to store, then click **Store Dino** again.",
      }).catch(() => {});
      return;
    }

    const growth = Number(safelog.growth);
    if (!Number.isFinite(growth) || growth < 0.9999) {
      await interaction.editReply({
        content:
          `Your latest SafeLog shows **${safelog.species ?? "Unknown"}** at growth **${Number.isFinite(growth) ? (growth * 100).toFixed(2) : "?"}%**.\n` +
          "This server requires **100% growth** to store dinos.",
      }).catch(() => {});
      return;
    }

    // Create snapshot + token BEFORE deleting anything.
    let snapshot;
    let token;
    try {
      snapshot = await createSnapshotFromSafelog({
        ownerSteam64: steam64,
        safelog,
        createdByDiscordId: interaction.user.id,
      });
      token = await createTokenForSnapshot({
        species: safelog.species ?? "Unknown",
        snapshotId: snapshot.id,
        issuedToSteam64: steam64,
        issuedByDiscordId: interaction.user.id,
      });
    } catch (e) {
      await interaction.editReply({ content: `Failed to create token. (${e?.message ?? String(e)})` }).catch(() => {});
      return;
    }

    // Delete save files (forces fresh spawn on next join).
    let del;
    try {
      del = await deletePlayerSaveFiles({
        ftpConfig: ctx.config.ftp,
        playerDataDir: ctx.config.ftp.playerDataDir,
        steam64,
      });
    } catch (e) {
      await interaction.editReply({
        content:
          `Token created (**${token.displayName}**) but failed to delete your save files.\n` +
          `Please contact an admin. (${e?.message ?? String(e)})`,
      }).catch(() => {});
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Dino Stored ✅")
      .setDescription(`**${token.displayName}**`)
      .addFields(
        { name: "Species", value: String(safelog.species ?? "Unknown"), inline: true },
        { name: "Growth", value: "100%", inline: true },
        { name: "Logged", value: safelog.at ?? "Unknown", inline: false },
        { name: "Save Deleted", value: `${del.removedSav ? "✅" : "❌"} .sav  |  ${del.removedBak ? "✅" : "❌"} .bak`, inline: false },
      )
      .setTimestamp();

    const thumb = tokenThumb(ctx);
    if (thumb) embed.setThumbnail(thumb);

    await interaction.editReply({
      content: "You may now rejoin the server — you'll spawn as a fresh dino.",
      embeds: [embed],
    }).catch(() => {});
    return;
  }

  if (id === "garage:player:my_tokens") {
    const steam64 = await resolveSteam64ForDiscord(interaction.user.id);
    if (!steam64) {
      await interaction.reply({ content: "You haven't linked your Steam64 yet. Use the Link panel first.", ...EPHEMERAL});
      return;
    }

    const tokens = await listTokensForSteam64(steam64);
    if (!tokens.length) {
      await interaction.reply({ content: "You have no available tokens.", ...EPHEMERAL });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("garage:player:my_tokens_select")
      .setPlaceholder("Select a token to view details")
      .addOptions(
        tokens.slice(0, 25).map((t) => ({
          label: t.displayName,
          description: `Species: ${t.species}`.slice(0, 100),
          value: t.token,
        }))
      );

    const embed = new EmbedBuilder()
      .setTitle("Your Tokens")
      .setDescription("Pick a token from the dropdown to view its details.")
      .setTimestamp();

    const thumb = tokenThumb(ctx);
    if (thumb) embed.setThumbnail(thumb);

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], ...EPHEMERAL });
    return;
  }

  if (id === "garage:player:redeem") {
    const modal = new ModalBuilder()
      .setCustomId("garage:player:redeem_modal")
      .setTitle("Redeem Dino Token");

    const token = new TextInputBuilder()
      .setCustomId("token")
      .setLabel("Token code")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("e.g. Tyrannasaurus45775");

    modal.addComponents(new ActionRowBuilder().addComponents(token));
    await interaction.showModal(modal);
    return;
  }

  if (id === "garage:player:store_dino") {
    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    // 1) Link check
    const steam64 = await resolveSteam64ForDiscord(interaction.user.id);
    if (!steam64) {
      await interaction.editReply({ content: "You haven't linked your Steam64 yet. Use the Link panel first." }).catch(() => {});
      return;
    }

    // 2) Must be offline (safer since we'll delete save files)
    let raw;
    try {
      raw = await ctx.rcon.sendRaw("playerlist");
    } catch (err) {
      await interaction.editReply({ content: `Failed to query player list: ${err?.message ?? String(err)}` }).catch(() => {});
      return;
    }

    const players = parsePlayers(raw);
    const online = players.some((p) => p?.steam64 === steam64);
    if (online) {
      await interaction.editReply({
        content:
          "You must be **fully offline** to store a dino (because your save files will be deleted).\n\n" +
          "✅ Safelog on the dino you want to store, wait until you're disconnected, then try again.",
      }).catch(() => {});
      return;
    }

    // 3) Read latest SafeLog entry for this Steam64
    let safelog;
    try {
      safelog = await getLatestSafelogForSteam64({
        ftpConfig: ctx.config.ftp,
        logsDir: ctx.config.ftp.logsDir,
        steam64,
        maxAgeMinutes: Number(ctx.config.tokens?.safelogMaxAgeMinutes ?? 10),
      });
    } catch (err) {
      await interaction.editReply({ content: `Failed to read server logs: ${err?.message ?? String(err)}` }).catch(() => {});
      return;
    }

    if (!safelog) {
      await interaction.editReply({
        content:
          "Couldn't find a recent SafeLog entry for you.\n\n" +
          "✅ Safelog on the dino you want to store, then click **Store Dino** again.",
      }).catch(() => {});
      return;
    }

    const growth = Number(safelog.growth ?? NaN);
    if (!Number.isFinite(growth) || growth < 0.9999) {
      await interaction.editReply({
        content:
          `Your last SafeLog shows **${safelog.species ?? "Unknown"}** at growth **${Number.isFinite(growth) ? (growth * 100).toFixed(2) : "?"}%**.\n\n` +
          "You can only store dinos that are **100% grown**.",
      }).catch(() => {});
      return;
    }

    // 4) Create snapshot + token (named from species)
    let snapshot;
    let token;
    try {
      snapshot = await createSnapshotFromSafelog({
        ownerSteam64: steam64,
        safelog,
        createdByDiscordId: interaction.user.id,
      });
      token = await createTokenForSnapshot({
        species: safelog.species ?? "Unknown",
        snapshotId: snapshot.id,
        issuedToSteam64: steam64,
        issuedByDiscordId: interaction.user.id,
      });
    } catch (err) {
      await interaction.editReply({ content: `Failed to create token: ${err?.message ?? String(err)}` }).catch(() => {});
      return;
    }

    // 5) Delete save files
    let del;
    try {
      del = await deletePlayerSaveFiles({
        ftpConfig: ctx.config.ftp,
        playerDataDir: ctx.config.ftp.playerDataDir,
        steam64,
      });
    } catch (err) {
      await interaction.editReply({
        content:
          `Token created (**${token.displayName}**) but failed to delete save files.\n\n` +
          `Error: ${err?.message ?? String(err)}`,
      }).catch(() => {});
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Dino Stored ✅")
      .setDescription(`Token created: **${token.displayName}**\n\nYou may now rejoin the server (fresh spawn).`)
      .addFields(
        { name: "Species", value: String(safelog.species ?? "Unknown"), inline: true },
        { name: "Growth", value: `${(growth * 100).toFixed(2)}%`, inline: true },
        { name: "Deleted", value: `${del.removedSav ? "✅" : "⚠️"} .sav\n${del.removedBak ? "✅" : "⚠️"} .sav.bak`, inline: true },
      )
      .setTimestamp();

    const thumb = tokenThumb(ctx);
    if (thumb) embed.setThumbnail(thumb);

    await interaction.editReply({ embeds: [embed] }).catch(() => {});
    return;
  }

  await interaction.reply({ content: "This garage button isn't wired yet.", ...EPHEMERAL});
}

export async function handleGarageModal(interaction, ctx) {
  const id = interaction.customId;

  if (id === "garage:admin:create_token_modal") {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    const species = interaction.fields.getTextInputValue("species");
    const steam64 = interaction.fields.getTextInputValue("steam64")?.trim() || null;
    const valuesRaw = interaction.fields.getTextInputValue("values")?.trim();

    let values = {};
    if (valuesRaw) {
      try {
        values = JSON.parse(valuesRaw);
      } catch {
        await interaction.editReply({ content: "Values JSON was not valid. Please paste valid JSON or leave blank." }).catch(() => {});
        return;
      }
    }

    const snapshot = await createSnapshotFromAdminInput({
      ownerSteam64: steam64,
      species,
      values,
      createdByDiscordId: interaction.user.id,
    });

    const token = await createTokenForSnapshot({
      species,
      snapshotId: snapshot.id,
      issuedToSteam64: steam64,
      issuedByDiscordId: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setTitle("Token Created ✅")
      .setDescription(`**${token.displayName}**`)
      .addFields(
        { name: "Species", value: token.species, inline: true },
        { name: "Assigned Steam64", value: token.issuedToSteam64 ?? "Unassigned (giftable)", inline: true },
      )
      .setTimestamp();

    const thumb = tokenThumb(ctx);
    if (thumb) embed.setThumbnail(thumb);

    await interaction.editReply({ embeds: [embed] }).catch(() => {});
    return;
  }

  if (id === "garage:admin:revoke_token_modal") {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});
    const tokenCode = interaction.fields.getTextInputValue("token");

    try {
      const token = await revokeToken({ tokenCode, revokedByDiscordId: interaction.user.id });

      const embed = new EmbedBuilder()
        .setTitle("Token Revoked ✅")
        .setDescription(`**${token.displayName}**`)
        .setTimestamp();
      const thumb = tokenThumb(ctx);
      if (thumb) embed.setThumbnail(thumb);

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await interaction.editReply({ content: err?.message ?? String(err) }).catch(() => {});
    }
    return;
  }

  if (id === "garage:admin:purge_inactive_tokens_modal") {
    if (!requireAdmin(interaction, ctx.config.roles.adminRoleId)) return;

    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    const confirm = interaction.fields.getTextInputValue("confirm")?.trim().toUpperCase();
    if (confirm !== "PURGE") {
      await interaction.editReply({ content: "Purge cancelled. (Confirmation text did not match.)" }).catch(() => {});
      return;
    }

    try {
      const result = await purgeInactiveTokens({ purgedByDiscordId: interaction.user.id });

      const embed = new EmbedBuilder()
        .setTitle("Inactive Tokens Purged ✅")
        .setDescription(
          `Deleted **${result.deletedTokens}** tokens and **${result.deletedSnapshots}** snapshots.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await interaction.editReply({ content: err?.message ?? String(err) }).catch(() => {});
    }
    return;
  }

  if (id === "garage:player:redeem_modal") {
    await interaction.deferReply({ ...EPHEMERAL }).catch(() => {});

    const steam64 = await resolveSteam64ForDiscord(interaction.user.id);
    if (!steam64) {
      await interaction.editReply({ content: "You haven't linked your Steam64 yet. Use the Link panel first." }).catch(() => {});
      return;
    }

    const tokenCode = interaction.fields.getTextInputValue("token");

    try {
      const redeemed = await redeemToken({
        tokenCode,
        redeemerDiscordId: interaction.user.id,
        redeemerSteam64: steam64,
      });

      
      // Fetch snapshot details for restore request (snapshot is soft-deleted but retained in garage.json)
      const snapshot = redeemed.snapshotId ? await getSnapshot(redeemed.snapshotId) : null;

      // Force fresh spawn: kick if online, then delete save files once offline
      let rawList = "";
      try {
        rawList = await ctx.rcon.sendRaw("playerlist");
      } catch {
        rawList = "";
      }
      const players = rawList ? parsePlayers(rawList) : [];
      const online = players.some((p) => p?.steam64 === steam64);

      if (online) {
        try {
          await ctx.rcon.sendRaw(`kick ${steam64},Restore token redeemed - please rejoin`);
        } catch {
          // ignore kick failure; we'll still require offline for deletion
        }
      }

      // Wait briefly for disconnect if they were online
      for (let i = 0; i < 8; i++) {
        try {
          const raw = await ctx.rcon.sendRaw("playerlist");
          const ps = parsePlayers(raw);
          const stillOnline = ps.some((p) => p?.steam64 === steam64);
          if (!stillOnline) break;
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Delete save files (only if offline)
      try {
        const raw = await ctx.rcon.sendRaw("playerlist");
        const ps = parsePlayers(raw);
        const stillOnline = ps.some((p) => p?.steam64 === steam64);
        if (!stillOnline) {
          await deletePlayerSaveFiles(steam64);
        }
      } catch {
        // If we can't confirm offline, do not delete.
      }

      // Post restore request for admins
      const restoreChannelId = ctx.config.channels?.restoreRequestsChannelId;
      if (restoreChannelId) {
        try {
          const ch = await ctx.client.channels.fetch(restoreChannelId);
          if (ch && ch.isTextBased()) {
            const req = new EmbedBuilder()
              .setTitle("🦖 Restore Request")
              .setDescription(`Token **${redeemed.displayName}** redeemed by <@${interaction.user.id}>`)
              .addFields(
                { name: "Steam64", value: steam64, inline: true },
                { name: "Species", value: snapshot?.species ?? redeemed.species ?? "Unknown", inline: true },
                { name: "Growth", value: snapshot?.growth != null ? String(snapshot.growth) : "Adult (100%)", inline: true },
                { name: "Gender", value: snapshot?.gender ?? "Unknown", inline: true },
                { name: "Snapshot Time", value: snapshot?.createdAt ?? snapshot?.timestamp ?? "Unknown", inline: false },
              )
              .setTimestamp();
            const thumb = tokenThumb(ctx);
            if (thumb) req.setThumbnail(thumb);
            await ch.send({ embeds: [req] });
          }
        } catch {
          // ignore if channel not accessible
        }
      }

const embed = new EmbedBuilder()
        .setTitle("Token Redeemed ✅")
        .setDescription(`**${redeemed.displayName}**\n\nA restore request has been sent to the admins. Your save has been reset (fresh spawn) — you can rejoin now.`)
        .setTimestamp();

      const thumb = tokenThumb(ctx);
      if (thumb) embed.setThumbnail(thumb);

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      await interaction.editReply({ content: err?.message ?? String(err) }).catch(() => {});
    }
    return;
  }

  await interaction.reply({ content: "This garage modal isn't wired yet.", ...EPHEMERAL});
}

export async function handleGarageSelect(interaction, ctx) {
  const id = interaction.customId;

  if (id === "garage:player:my_tokens_select") {
    await interaction.deferUpdate().catch(() => {});

    const steam64 = await resolveSteam64ForDiscord(interaction.user.id);
    if (!steam64) {
      await interaction.editReply({ content: "You haven't linked your Steam64 yet. Use the Link panel first.", components: [] }).catch(() => {});
      return;
    }

    const tokenCode = interaction.values?.[0];
    const tokens = await listTokensForSteam64(steam64);
    const token = tokens.find((t) => t.token === tokenCode);

    if (!token) {
      await interaction.editReply({ content: "That token is no longer available.", components: [] }).catch(() => {});
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Token Details")
      .setDescription(`**${token.displayName}**`)
      .addFields(
        { name: "Species", value: String(token.species ?? "Unknown"), inline: true },
        { name: "Created", value: String(token.createdAt ?? "Unknown"), inline: true },
        { name: "Redeem", value: "Use the **Redeem Token** button and paste the code above.", inline: false },
      )
      .setTimestamp();

    const thumb = tokenThumb(ctx);
    if (thumb) embed.setThumbnail(thumb);

    // Rebuild the dropdown so it stays usable after viewing details.
    const select = new StringSelectMenuBuilder()
      .setCustomId("garage:player:my_tokens_select")
      .setPlaceholder("Select a token to view details")
      .addOptions(
        tokens.slice(0, 25).map((t) => ({
          label: t.displayName,
          description: `Species: ${t.species}`.slice(0, 100),
          value: t.token,
          default: t.token === tokenCode,
        }))
      );

    await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] }).catch(() => {});
    return;
  }

  await interaction.reply({ content: "This dropdown isn't wired yet.", ...EPHEMERAL }).catch(() => {});
}
