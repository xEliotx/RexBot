// src/discord/link/linkHandlers.js
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { auditLog } from "../admin/audit.js";
import { linkStore } from "../../storage/stores.js";
import { getLatestSafelogForSteam64 } from "../../ftp/safelog.js";

function looksLikeSteam64(s) {
  const v = String(s || "").trim();
  // SteamID64 is 17 digits (usually starts with 7656)
  return /^\d{17}$/.test(v);
}

function openSteam64Modal(interaction) {
  const modal = new ModalBuilder().setCustomId("link:modal:submit").setTitle("Link Steam64");

  const steam64 = new TextInputBuilder()
    .setCustomId("steam64")
    .setLabel("Enter your Steam64 (17 digits)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("7656119...")
    .setMaxLength(17)
    .setMinLength(17);

  modal.addComponents(new ActionRowBuilder().addComponents(steam64));
  return interaction.showModal(modal);
}

function openConfirmUnlink(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("link:unlink:confirm").setLabel("Confirm Unlink").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("link:unlink:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );

  return interaction.reply({
    content: "Are you sure you want to unlink your Steam64?",
    components: [row],
    ephemeral: true,
  });
}

async function findDiscordIdBySteam64(steam64) {
  const data = await linkStore.getAll();
  const links = data.links || {};
  for (const [discordId, rec] of Object.entries(links)) {
    if (rec?.steam64 === steam64) return discordId;
  }
  return null;
}

export async function handleLinkButton(interaction, ctx) {
  const id = interaction.customId;

  if (id === "link:start") {
    return openSteam64Modal(interaction);
  }

  if (id === "link:status") {
    const rec = await linkStore.getFromMap("links", interaction.user.id);
    if (!rec) {
      await interaction.reply({ content: "You are not linked yet. Click **Link Steam64** to begin.", ...EPHEMERAL});
      return;
    }

    // Best-effort verification: if we've ever seen this Steam64 in the server logs,
    // mark it as verified. This avoids a perpetual "verified=false".
    let verified = Boolean(rec.verified);
    if (!verified && rec.steam64) {
      try {
        const any = await getLatestSafelogForSteam64({
          ftpConfig: ctx.config.ftp,
          logsDir: ctx.config.ftp.logsDir,
          steam64: rec.steam64,
          // Large window: we just want to know if the server ever logged this Steam64.
          maxAgeMinutes: 60 * 24 * 365,
          maxFiles: 20,
        });
        if (any) {
          verified = true;
          rec.verified = true;
          await linkStore.setInMap("links", interaction.user.id, rec);
        }
      } catch {
        // Ignore verification errors; status should still work.
      }
    }

    const when = rec.linkedAt ? `<t:${Math.floor(rec.linkedAt / 1000)}:R>` : "unknown";
    const verifiedText = verified ? "Yes" : "No";

    await interaction.reply({
      content: `✅ Linked Steam64: **${rec.steam64}**\nLinked: ${when}\nVerification: **${verifiedText}**`,
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("link:unlink").setLabel("Unlink").setStyle(ButtonStyle.Danger),
        ),
      ],
    });
    return;
  }

  if (id === "link:unlink") {
    return openConfirmUnlink(interaction);
  }

  if (id === "link:unlink:confirm") {
    const ok = await linkStore.deleteFromMap("links", interaction.user.id);

    if (ok) {
      await auditLog(
        ctx.client,
        ctx.config.channels,
        `🔗❌ **UNLINK** by <@${interaction.user.id}>`
      );
    }

    await interaction.update({
      content: ok ? "Unlinked ✅" : "You weren’t linked.",
      components: [],
    });
    return;
  }

  if (id === "link:unlink:cancel") {
    await interaction.update({ content: "Cancelled.", components: [] });
    return;
  }

  await interaction.reply({ content: "Unknown link action.", ...EPHEMERAL});
}

export async function handleLinkModal(interaction, ctx) {
  const id = interaction.customId;
  if (id !== "link:modal:submit") return;

  await interaction.deferReply({ ...EPHEMERAL });

  const steam64 = interaction.fields.getTextInputValue("steam64").trim();

  if (!looksLikeSteam64(steam64)) {
    await interaction.editReply("That doesn’t look like a valid Steam64 (must be 17 digits).");
    return;
  }

  // Prevent multiple Discord accounts linking the same Steam64
  const existingDiscord = await findDiscordIdBySteam64(steam64);
  if (existingDiscord && existingDiscord !== interaction.user.id) {
    await interaction.editReply(
      `That Steam64 is already linked to another Discord account. Please contact staff if you need it changed.`
    );
    return;
  }

  const record = {
    steam64,
    linkedAt: Date.now(),
    verified: false, // verification via logs comes later
  };

  await linkStore.setInMap("links", interaction.user.id, record);

  await auditLog(
    ctx.client,
    ctx.config.channels,
    `🔗 **LINK** by <@${interaction.user.id}> → **${steam64}** (verified=false)`
  );

  await interaction.editReply(`Linked ✅\nSteam64: **${steam64}**\n(Verification via logs can be added later.)`);
}
