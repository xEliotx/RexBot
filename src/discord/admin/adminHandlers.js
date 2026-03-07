// src/discord/admin/adminHandlers.js
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { parsePlayers } from "./playerParser.js";
import { auditLog } from "./audit.js";
import { unbanSteam64 } from "../../ftp/bans.js";

function makePlayerSelect(customId, players, placeholder) {
  const options = players.slice(0, 25).map((p) => ({
    label: (p.name || "Unknown").slice(0, 100),
    description: `${p.steam64 ? `Steam:${p.steam64}` : ""}`.trim().slice(0, 100),
    value: JSON.stringify({ steam64: p.steam64, name: p.name }),
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options)
  );
}

function openKickReasonModal(interaction, player) {
  const modal = new ModalBuilder().setCustomId("admin:kick:reason").setTitle("Kick Player");

  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel(`Reason for kicking ${player.name}?`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("Reason…")
    .setMaxLength(120);

  modal.addComponents(new ActionRowBuilder().addComponents(reason));
  return interaction.showModal(modal);
}

function openBanModal(interaction, player) {
  const modal = new ModalBuilder().setCustomId("admin:ban:reason").setTitle("Ban Player");

  const hours = new TextInputBuilder()
    .setCustomId("hours")
    .setLabel("Ban duration (hours, 0=perm)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("0")
    .setMaxLength(6);

  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel(`Reason for banning ${player.name}?`.slice(0, 45))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("Reason…")
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(hours),
    new ActionRowBuilder().addComponents(reason)
  );

  return interaction.showModal(modal);
}

function openTextModal(interaction, modalId, title, label, placeholder = "") {
  const modal = new ModalBuilder().setCustomId(modalId).setTitle(title);

  const text = new TextInputBuilder()
    .setCustomId("text")
    .setLabel(label.length > 45 ? label.slice(0, 45) : label)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder(placeholder)
    .setMaxLength(1500);

  modal.addComponents(new ActionRowBuilder().addComponents(text));
  return interaction.showModal(modal);
}

async function ensureRcon(ctx) {
  await ctx.rcon.connect();
}

export async function handleAdminButton(interaction, ctx) {
  const id = interaction.customId;
  // Kick/Ban flows need player list
  if (id === "admin:kick" || id === "admin:ban") {
    await interaction.deferReply({ ...EPHEMERAL });

    await ensureRcon(ctx);
    const raw = await ctx.rcon.sendRaw("players");
    const players = parsePlayers(raw);

    if (!players.length) {
      await interaction.editReply({
        content:
          "No players found. (If someone is online, paste the players output so we can tune parsing.)",
      });
      return;
    }

    const selectId = id === "admin:kick" ? "admin:kick:select" : "admin:ban:select";
    const row = makePlayerSelect(selectId, players, "Select a player…");

    await interaction.editReply({
      content: `Select who to ${id === "admin:kick" ? "kick" : "ban"}:`,
      components: [row],
    });
    return;
  }

  if (id === "admin:announce") {
    await openTextModal(
      interaction,
      "admin:announce:modal",
      "Announcement",
      "Announcement message",
      "Type the server-wide announcement here…"
    );
    return;
  }

  if (id === "admin:raw") {
    await openTextModal(
      interaction,
      "admin:raw:modal",
      "Raw RCON Command",
      "Enter RCON command",
      "e.g. players | save | announce Hello"
    );
    return;
  }

  // Unban via FTP editing PlayerBans.json
  if (id === "admin:unban") {
    await openTextModal(
      interaction,
      "admin:unban:modal",
      "Unban",
      "Enter Steam64 to unban",
      "7656119..."
    );
    return;
  }

  await interaction.reply({ content: "Unknown admin action.", ...EPHEMERAL});
}

export async function handleAdminSelect(interaction, ctx) {
  const id = interaction.customId;
  const selected = interaction.values?.[0];
  if (!selected) return;
  const player = JSON.parse(selected);

  // Cache selection
  ctx.session.set(`${interaction.user.id}:${id}`, player);

  if (id === "admin:kick:select") {
    await openKickReasonModal(interaction, player);
    return;
  }

  if (id === "admin:ban:select") {
    await openBanModal(interaction, player);
    return;
  }

  await interaction.reply({ content: "Unknown selection.", ...EPHEMERAL});
}

export async function handleAdminModal(interaction, ctx) {
  const id = interaction.customId;
  // Kick finalize
  if (id === "admin:kick:reason") {
    await interaction.deferReply({ ...EPHEMERAL });

    const reason = interaction.fields.getTextInputValue("reason");
    const player = ctx.session.get(`${interaction.user.id}:admin:kick:select`);

    if (!player) {
      await interaction.editReply({ content: "Selection expired. Click the button again." });
      return;
    }

    const steam64 = player.steam64;
    if (!steam64) {
      await interaction.editReply({ content: "Missing Steam64 for this player." });
      return;
    }

    // kick [SteamID64,Reason]
    const cmd = `kick ${steam64},${reason}`;

    await ensureRcon(ctx);
    const resp = await ctx.rcon.sendRaw(cmd);

    await auditLog(
      ctx.client,
      ctx.config.channels,
      `🛠️ **KICK** by <@${interaction.user.id}> → **${player.name}** (${steam64}) Reason: **${reason}**`
    );

    await interaction.editReply({
      content: `Sent: \`${cmd}\`\nResponse:\n\`\`\`\n${resp || "(no response)"}\n\`\`\``,
    });
    return;
  }

  // Ban finalize
  if (id === "admin:ban:reason") {
    await interaction.deferReply({ ...EPHEMERAL });

    const hoursRaw = interaction.fields.getTextInputValue("hours").trim();
    const reason = interaction.fields.getTextInputValue("reason");

    const player = ctx.session.get(`${interaction.user.id}:admin:ban:select`);
    if (!player) {
      await interaction.editReply({ content: "Selection expired. Click the button again." });
      return;
    }

    const steam64 = player.steam64;
    const name = (player.name || "").replace(/,/g, " "); // commas break CSV
    const hours = Number.isFinite(Number(hoursRaw)) ? String(Number(hoursRaw)) : "0";

    if (!steam64) {
      await interaction.editReply({ content: "Missing Steam64 for this player." });
      return;
    }

    // ban [Name,SteamID64,Reason,Time]
    const cmd = `ban ${name},${steam64},${reason.replace(/,/g, " ")},${hours}`;

    await ensureRcon(ctx);
    const resp = await ctx.rcon.sendRaw(cmd);

    await auditLog(
      ctx.client,
      ctx.config.channels,
      `⛔ **BAN** by <@${interaction.user.id}> → **${player.name}** (${steam64}) Hours: **${hours}** Reason: **${reason}**`
    );

    await interaction.editReply({
      content: `Sent: \`${cmd}\`\nResponse:\n\`\`\`\n${resp || "(no response)"}\n\`\`\``,
    });
    return;
  }

  // Announce
  if (id === "admin:announce:modal") {
    await interaction.deferReply({ ...EPHEMERAL });

    const text = interaction.fields.getTextInputValue("text");
    const cmd = `announce ${text}`;

    await ensureRcon(ctx);
    const resp = await ctx.rcon.sendRaw(cmd);

    await auditLog(
      ctx.client,
      ctx.config.channels,
      `📣 **ANNOUNCE** by <@${interaction.user.id}> → ${text.slice(0, 500)}`
    );

    await interaction.editReply({
      content: `Announcement sent.\nResponse:\n\`\`\`\n${resp || "(no response)"}\n\`\`\``,
    });
    return;
  }

  // Raw
  if (id === "admin:raw:modal") {
    await interaction.deferReply({ ...EPHEMERAL });

    const text = interaction.fields.getTextInputValue("text").trim();

    await ensureRcon(ctx);
    const resp = await ctx.rcon.sendRaw(text);

    await auditLog(
      ctx.client,
      ctx.config.channels,
      `⚙️ **RAW RCON** by <@${interaction.user.id}> → \`${text.slice(0, 200)}\``
    );

    await interaction.editReply({
      content: `Response:\n\`\`\`\n${resp || "(no response)"}\n\`\`\``,
    });
    return;
  }

  // Unban via FTP: remove from PlayerBans.json
  if (id === "admin:unban:modal") {
    await interaction.deferReply({ ...EPHEMERAL });

    const steam64 = interaction.fields.getTextInputValue("text").trim();

    const result = await unbanSteam64({
      ftpConfig: ctx.config.ftp,
      bansFilePath: ctx.config.ftp.bansFilePath,
      steam64,
    });

    // Optional: ask server to save after updating ban file (non-fatal if fails)
    try {
      await ensureRcon(ctx);
      await ctx.rcon.sendRaw("save");
    } catch {}

    await auditLog(
      ctx.client,
      ctx.config.channels,
      `✅ **UNBAN** by <@${interaction.user.id}> → ${steam64} (removed=${result.removed})`
    );

    await interaction.editReply({
      content:
        result.removed > 0
          ? `Unbanned **${steam64}** ✅ (removed ${result.removed} entry)\nBanlist count: ${result.before} → ${result.after}`
          : `No ban entry found for **${steam64}**.\nBanlist count: ${result.before}`,
    });

    return;
  }

  await interaction.reply({ content: "Unknown modal.", ...EPHEMERAL});
}
