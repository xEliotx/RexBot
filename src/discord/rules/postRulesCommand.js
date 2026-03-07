import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { rulesPosts } from "./rulesEmbeds.js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ChannelScope } from "../guards/channels.js";

import { upsertNewPlayerGuideBook } from "../rules/NewPlayerGuideBook.js";

const MAP_DIR = path.resolve(process.cwd(), "data");
const MAP_FILE = path.join(MAP_DIR, "rulesMessageMap.json");

async function loadMap() {
  try {
    const raw = await readFile(MAP_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveMap(map) {
  await mkdir(MAP_DIR, { recursive: true });
  await writeFile(MAP_FILE, JSON.stringify(map, null, 2), "utf8");
}

/**
 * Locks a rules channel by denying @everyone from sending messages.
 * This only applies to channels in rulesPosts.
 */
async function lockChannel(channel) {
  const everyoneRoleId = channel.guild.id;

  await channel.permissionOverwrites.edit(everyoneRoleId, {
    SendMessages: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
  });
}

export const data = new SlashCommandBuilder()
  .setName("postrules")
  .setDescription("Post or update rules embeds in their channels (admin only).")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, { logger }) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const results = [];

  // 1) Update-in-place New Player Guide / Encyclopedia (your new system)
  try {
    await upsertNewPlayerGuideBook(interaction.client);
	results.push("✅ New Player Guide (book) updated <#1469392438345859112>");
  } catch (err) {
 	logger?.error?.("New Player Guide (book) failed:", err);
  	results.push(`❌ New Player Guide failed: ${err?.message ?? "Unknown error"}`);
}


  // 2) Your original rulesPosts updater (kept intact)
  const map = await loadMap();

  for (const post of rulesPosts) {
    const channel = await interaction.client.channels
      .fetch(post.channelId)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      results.push(`❌ <#${post.channelId}> not found / not text-based`);
      continue;
    }

    const existingMessageId = map[post.key];

    try {
      // Try edit existing message if we have an ID stored
      if (existingMessageId) {
        const msg = await channel.messages.fetch(existingMessageId).catch(() => null);

        if (msg) {
          await msg.edit({ embeds: [post.embed], components: [] });

          // 🔒 lock after update
          try {
            await lockChannel(channel);
            results.push(`✅ Updated + locked <#${post.channelId}>`);
          } catch (lockErr) {
            logger?.warn?.("Failed to lock channel:", lockErr);
            results.push(`✅ Updated <#${post.channelId}> (lock failed)`);
          }

          continue;
        }
      }

      // If missing/deleted/not stored: send new + store ID
      const sent = await channel.send({ embeds: [post.embed] });
      map[post.key] = sent.id;

      // 🔒 lock after post
      try {
        await lockChannel(channel);
        results.push(`🆕 Posted + locked <#${post.channelId}>`);
      } catch (lockErr) {
        logger?.warn?.("Failed to lock channel:", lockErr);
        results.push(`🆕 Posted <#${post.channelId}> (lock failed)`);
      }
    } catch (err) {
      logger?.error?.("postrules failed:", err);
      results.push(`❌ Failed in <#${post.channelId}> (${err?.code ?? "no code"})`);
    }
  }

  await saveMap(map);
  await interaction.editReply(results.join("\n"));
}

export const postRules = {
  data,
  execute,
  scope: ChannelScope.ADMIN,
};
