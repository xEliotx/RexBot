import { EmbedBuilder } from "discord.js";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

const STORE_PATH = "src/discord/rules/data/encyclopediaMessageIds.json";

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      await fsp.mkdir(path.dirname(STORE_PATH), { recursive: true });
      await fsp.writeFile(STORE_PATH, JSON.stringify({}, null, 2), "utf8");
    }
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

/**
 * Create an encyclopedia-style entry from local images.
 * One image = one embed.
 */
export function createEncyclopediaEntry({
  key,
  channelId,
  title,
  imageFiles,
  toc,
  color = 0x5865f2,
  footerText,
}) {
  const pages = [];

  // Table of contents page (no image)
  if (toc) {
    const tocEmbed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(toc.description)
      .setColor(color);

    if (footerText) tocEmbed.setFooter({ text: footerText });

    // 👇 If a TOC banner image is provided, use it as the embed image
    if (toc.tocImageFile) {
      const fileName = path.basename(toc.tocImageFile);
      tocEmbed.setImage(`attachment://${fileName}`);

      pages.push({
        embed: tocEmbed,
        filePath: toc.tocImageFile,
        fileName,
      });
    } else {
      pages.push({ embed: tocEmbed });
    }
  }
  const imageTotal = imageFiles.length;

  imageFiles.forEach((filePath, index) => {
    const fileName = path.basename(filePath);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(`Page ${index + 1} / ${imageTotal}`)
      .setImage(`attachment://${fileName}`)
      .setColor(color);

    if (footerText) embed.setFooter({ text: footerText });

    pages.push({ embed, filePath, fileName });
  });

  return { key, channelId, pages, imageFiles, toc, title, color, footerText };
}
/**
 * Send embeds in chunks of 10 (Discord limit)
 */
export async function upsertEncyclopediaEntry(channel, entryKey, pages) {
  const CHUNK_SIZE = 10;

  const store = await loadStore();
  store[entryKey] ??= { channelId: channel.id, messageIds: [] };

  // If channel changed, reset stored messages (avoids editing wrong channel)
  if (store[entryKey].channelId !== channel.id) {
    store[entryKey] = { channelId: channel.id, messageIds: [] };
  }

  const chunks = chunkArray(pages, CHUNK_SIZE);
  const messageIds = store[entryKey].messageIds;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const payload = { embeds: chunk.map(p => p.embed) };

    const files = chunk
      .filter(p => p.filePath && p.fileName)
      .map(p => ({ attachment: p.filePath, name: p.fileName }));

    if (files.length) payload.files = files;

    const existingId = messageIds[i];

    if (existingId) {
      const msg = await channel.messages.fetch(existingId).catch(() => null);
      if (msg) {
        await msg.edit(payload);
      } else {
        const newMsg = await channel.send(payload);
        messageIds[i] = newMsg.id;
      }
    } else {
      const newMsg = await channel.send(payload);
      messageIds[i] = newMsg.id;
    }
  }

  // Delete extra old messages if guide got shorter
  if (messageIds.length > chunks.length) {
    const extras = messageIds.slice(chunks.length);
    for (const id of extras) {
      const msg = await channel.messages.fetch(id).catch(() => null);
      if (msg) await msg.delete().catch(() => null);
    }
    store[entryKey].messageIds = messageIds.slice(0, chunks.length);
  } else {
    store[entryKey].messageIds = messageIds;
  }

  await saveStore(store);
}
