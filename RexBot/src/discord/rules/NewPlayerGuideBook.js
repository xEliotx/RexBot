import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { NEW_PLAYER_GUIDE } from "./encyclopediaEntries.js";

const ENTRY_KEY = "new_player_guide_book";

// Where we store the posted message id so we can update in place
const STORE_PATH = path.resolve(process.cwd(), "data", "guideBookMessage.json");

const GUIDE_CHANNEL_ID = "1469392438345859112";
const CONTENT_FILES = NEW_PLAYER_GUIDE.imageFiles; // same order as encyclopediaEntries.js

// Cover / intro
const THUMB_IMAGE = "assets/logo.png";
const COVER_IMAGE = "assets/encyclopedia.png";
const COVER_TEXT = [
  "Welcome to **Blood & Bone**! This guide helps new players get started.",
  "",
  "🦴**What you'll find here**🦴",
  "> • Getting started basics",
  "> • Diet/Food information",
  "> • 'How to' guides",
  "*New ones will be added/updated as we grow*",
  "",
  "⮟🎫**Need help? Create a ticket at**🎫⮟",
  "<#1467572329444938024>",
  "",
  "⮟🗺️**The isle - Interactive map**🗺️⮟",
  "https://vulnona.com/game/map/#map=Gateway_v0.21",
  "",
  "Use the buttons below to read ⬇️",
].join("\n");


// Total “book pages” includes cover page at index 0
function totalPages() {
  return 1 + CONTENT_FILES.length;
}

function buildSpread(startIndex) {
  const total = totalPages();

  // Cover (index 0) stays the same behavior as before
  if (startIndex === 0) {
    const fileName = path.basename(COVER_IMAGE);
    const thumbName = path.basename(THUMB_IMAGE);

    const embed = new EmbedBuilder()
      .setTitle("🌟 New Player Guide")
      .setDescription(COVER_TEXT)
      .setThumbnail(`attachment://${thumbName}`)
      .setImage(`attachment://${fileName}`)
      .setColor(0x5865f2)
      .setFooter({ text: `Cover • Page 1 / ${total}` });

    return {
      embeds: [embed],
      files: [
        { attachment: COVER_IMAGE, name: fileName },
        { attachment: THUMB_IMAGE, name: thumbName },
      ],
    };
  }

  // Content pages (startIndex 1..)
  const embeds = [];
  const files = [];

  // We will show startIndex and startIndex+1 if possible
  for (let offset = 0; offset < 2; offset++) {
    const pageIndex = startIndex + offset; // 1..total-1
    const imgArrayIndex = pageIndex - 1;   // 0..CONTENT_FILES.length-1
    const imgPath = CONTENT_FILES[imgArrayIndex];
    if (!imgPath) break;

    const fileName = path.basename(imgPath);

    const embed = new EmbedBuilder()
      .setTitle("🌟 New Player Guide")
      .setDescription(`Page ${pageIndex + 1} / ${total}`)
      .setImage(`attachment://${fileName}`)
      .setColor(0x5865f2);

    embeds.push(embed);
    files.push({ attachment: imgPath, name: fileName });
  }

  return { embeds, files };
}

// Build the embed + attachments for a given book page
function buildPage(pageIndex) {
  const total = totalPages();

  // Cover page (index 0)
  if (pageIndex === 0) {
    const fileName = path.basename(COVER_IMAGE);
    const thumbName = path.basename(THUMB_IMAGE);


    const embed = new EmbedBuilder()
      .setTitle("🌟 New Player Guide")
      .setDescription(COVER_TEXT)
      .setThumbnail(`attachment://${thumbName}`)
      .setImage(`attachment://${fileName}`)
      .setColor(0x5865f2)
      .setFooter({ text: `Cover • Page 1 / ${total}` });

    return {
      embed,
      files: [
        { attachment: COVER_IMAGE, name: fileName },
        { attachment: THUMB_IMAGE, name: thumbName },
      ],
    };
  }

  // Normal pages (index 1..)
  const imgPath = CONTENT_FILES[pageIndex - 1];
  const fileName = path.basename(imgPath);

  const embed = new EmbedBuilder()
    .setTitle("🌟 New Player Guide")
    .setDescription(`Page ${pageIndex + 1} / ${total}`)
    .setImage(`attachment://${fileName}`)
    .setColor(0x5865f2);

  return {
    embed,
    files: [{ attachment: imgPath, name: fileName }],
  };
}

function buildBookButtons(startIndex) {
  const total = totalPages();
  const lastContentIndex = total - 1;

  const prevIndex = startIndex === 0 ? 0 : Math.max(startIndex - 2, 1);
  const nextIndex =
    startIndex === 0 ? 1 : Math.min(startIndex + 2, lastContentIndex);

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`npguide:home:0`)
      .setLabel("⏮ Start")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(startIndex === 0),

    new ButtonBuilder()
      .setCustomId(`npguide:prev:${startIndex}`)
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(startIndex === 0),

    new ButtonBuilder()
      .setCustomId(`npguide:next:${startIndex}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(startIndex !== 0 && startIndex >= lastContentIndex)
  );
}

// --- store helpers ---
async function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const raw = await fsp.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function saveStore(store) {
  await fsp.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fsp.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function buildPosterButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("npguide:open")
      .setLabel("📖 Open Guide")
      .setStyle(ButtonStyle.Success)
  );
}
/**
 * Create or update the single “book” message in the guide channel.
 * This is your update-in-place entry point.
 */
export async function upsertNewPlayerGuideBook(client) {
  const channel = await client.channels.fetch(GUIDE_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Guide channel not found / not text-based.");
  }

  const store = await loadStore();
  const messageId = store[ENTRY_KEY]?.messageId ?? null;

  const pageIndex = 0;
  const { embed, files } = buildPage(pageIndex);

  const payload = {
    embeds: [embed],
    components: [buildPosterButtons()],
    files,
  };

  if (messageId) {
    const msg = await channel.messages.fetch(messageId).catch(() => null);

    // Only edit if THIS bot authored the message
    if (msg && msg.author?.id === client.user.id) {
      await msg.edit(payload);
      return;
    }
  }

  // Otherwise send a fresh message
  const sent = await channel.send(payload);
  store[ENTRY_KEY] = { channelId: channel.id, messageId: sent.id };
  await saveStore(store);
}
/**
 * Handle button clicks globally (call this from interactionCreate).
 */
export async function handleNewPlayerGuideBookButtons(interaction) {
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith("npguide:")) return false;

  const [, action, pageStr] = interaction.customId.split(":");

  // Open Guide -> send ephemeral book at page 0
  if (action === "open") {
    const { embeds, files } = buildSpread(0);

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds,
      components: [buildBookButtons(0)],
      files,
    });

    return true;
  }

  // Accept both old + new action names
  const isNav = ["next", "prev", "home", "enext", "eprev", "ehome"].includes(action);
  if (!isNav) return false;

  const current = Number(pageStr);
  if (!Number.isFinite(current)) return false;

  const total = totalPages();
  const lastContentIndex = total - 1;

  let next = current;

  if (action === "next" || action === "enext") {
    if (current === 0) next = 1;
    else next = Math.min(current + 2, lastContentIndex);
  } else if (action === "prev" || action === "eprev") {
    if (current === 0) next = 0;
    else next = Math.max(current - 2, 1);
  } else if (action === "home" || action === "ehome") {
    next = 0;
  }

  const { embeds, files } = buildSpread(next);

  await interaction.update({
    embeds,
    components: [buildBookButtons(next)],
    files,
  });

  return true;
}

