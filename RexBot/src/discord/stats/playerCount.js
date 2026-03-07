import { parsePlayers } from "../admin/playerParser.js";
// NOTE: This file intentionally does not persist channel IDs.
// The restart timer channel must be provided via RESTART_TIMER_CHANNEL_ID.

function parseRestartHoursUtc() {
  // Configure with RESTART_HOURS_UTC="0,6,12,18" (default) or e.g. "0,4,8,12,16,20".
  const raw = String(process.env.RESTART_HOURS_UTC ?? "0,6,12,18").trim();
  const hours = raw
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 23);

  // De-dup + sort
  return Array.from(new Set(hours)).sort((a, b) => a - b);
}

function getNextRestartUtc(now = new Date()) {
  const hours = parseRestartHoursUtc();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  for (const h of hours) {
    const candidate = new Date(Date.UTC(y, m, d, h, 0, 0));
    if (candidate > now) return candidate;
  }
  // Next day at the first scheduled hour
  const first = hours[0] ?? 0;
  return new Date(Date.UTC(y, m, d + 1, first, 0, 0));
}

function formatCountdown(ms) {
  const safe = Math.max(0, ms);
  const totalMinutes = Math.floor(safe / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


async function lockVoiceChannel(channel, { logger } = {}) {
  // Only guild channels have permission overwrites
  if (!channel?.guild) return;

  const me = channel.guild.members.me ?? (await channel.guild.members.fetchMe().catch(() => null));
  if (!me) return;
  const perms = channel.permissionsFor(me);
  if (!perms?.has?.(["ViewChannel", "ManageChannels"])) {
    logger?.warn?.(
      `Skipping lock for channel ${channel?.id}: missing ViewChannel/ManageChannels (bot perms: ${perms?.toArray?.().join(", ") ?? "unknown"})`
    );
    return;
  }

  // For voice/stat channels you typically want them visible but not joinable
  const everyoneRoleId = channel.guild.roles.everyone.id;

  try {
    await channel.permissionOverwrites.edit(everyoneRoleId, {
      Connect: false,
    }, { reason: "Auto-lock stat voice channel on startup" });
  } catch (e) {
    logger?.warn?.(
      `Failed to lock channel ${channel?.id}: ${e?.code ?? ""} ${e?.message ?? e}`
    );
  }
}
/**
 * Updates:
 *  - a dedicated "player count" voice channel name with the current online player count
 *  - a dedicated "next restart" voice channel name with the time until next scheduled restart (GMT/UTC)
 *
 * The restart timer channel MUST be provided via RESTART_TIMER_CHANNEL_ID.
 * If it's not provided, the restart timer updater will be skipped.
 */
export function startPlayerCountUpdater({ client, rcon, config, logger }) {
  const playerCountChannelId = config.channels.playerCountChannelId;
  if (!playerCountChannelId) {
    logger?.warn?.("PLAYER_COUNT_CHANNEL_ID not set; skipping player count updater.");
    return;
  }

  const intervalMs = Number(process.env.PLAYER_COUNT_UPDATE_MS ?? 90_000);

  let lastPlayerName = null;
  let lastRestartName = null;
  let running = false;
  let playerLocked = false;
  let restartLocked = false;
  let warnedPlayerPerms = false;
  let warnedRestartPerms = false;
  let disablePlayerCount = false;
  let disableRestartTimer = false;

  async function getRestartChannelFromEnv() {
    const envId = (config.channels.restartTimerChannelId ?? "").trim();
    if (!envId) {
      logger?.warn?.("RESTART_TIMER_CHANNEL_ID not set; skipping restart timer updater.");
      return null;
    }

    const ch = await client.channels.fetch(envId).catch((e) => {
      logger?.warn?.(
        `Failed to fetch restart timer channel ${envId}: ${e?.code ?? ""} ${e?.message ?? e}`
      );
      return null;
    });

    return ch;
  }

  async function tick() {
    if (disablePlayerCount && disableRestartTimer) return;
    if (running) return;
    running = true;

    try {
      const playerCh = disablePlayerCount
        ? null
        : await client.channels.fetch(playerCountChannelId).catch((e) => {
        logger?.warn?.(
          `Failed to fetch player count channel ${playerCountChannelId}: ${e?.code ?? ""} ${e?.message ?? e}`
        );
        return null;
      });

      if (!playerCh && !disablePlayerCount) {
        logger?.warn?.(`Player count channel not found: ${playerCountChannelId}`);
        disablePlayerCount = true;
      }

      if (playerCh && playerCh.guild) {
        const me = playerCh.guild.members.me ?? (await playerCh.guild.members.fetchMe().catch(() => null));
        const perms = me ? playerCh.permissionsFor(me) : null;
        if (!perms?.has?.(["ViewChannel", "ManageChannels"])) {
          if (!warnedPlayerPerms) {
            logger?.warn?.(
              `Cannot manage player count channel ${playerCountChannelId}: missing ViewChannel/ManageChannels (bot perms: ${perms?.toArray?.().join(", ") ?? "unknown"})`
            );
            warnedPlayerPerms = true;
          }
          disablePlayerCount = true;
        }
      }

      if (playerCh && !playerLocked) {
        await lockVoiceChannel(playerCh, { logger });
        playerLocked = true;
      }

      // Query players
      let raw;
      try {
        raw = await rcon.sendRaw("playerlist");
      } catch (e) {
        // Back-compat fallback for servers that use the older alias.
        raw = await rcon.sendRaw("players");
      }
      const players = parsePlayers(raw);
      const count = players.length;

      if (playerCh) {
        const newPlayerName = `🦖 Players: ${count}`;
        if (newPlayerName !== lastPlayerName && playerCh.name !== newPlayerName) {
          await playerCh
            .setName(newPlayerName, "Auto-updating Evrima player count")
            .catch((e) => {
              logger?.warn?.(`Failed to rename player count channel: ${e?.code ?? ""} ${e?.message ?? e}`);
              // Stop hammering the API if Discord says we can't access/manage it.
              if (e?.code === 50001 || e?.code === 50013) disablePlayerCount = true;
            });
        }
        lastPlayerName = newPlayerName;
      }

      // Restart timer
      const restartCh = disableRestartTimer ? null : await getRestartChannelFromEnv();
      if (restartCh && restartCh.guild) {
        const me = restartCh.guild.members.me ?? (await restartCh.guild.members.fetchMe().catch(() => null));
        const perms = me ? restartCh.permissionsFor(me) : null;
        if (!perms?.has?.(["ViewChannel", "ManageChannels"])) {
          if (!warnedRestartPerms) {
            logger?.warn?.(
              `Cannot manage restart timer channel ${restartCh.id}: missing ViewChannel/ManageChannels (bot perms: ${perms?.toArray?.().join(", ") ?? "unknown"})`
            );
            warnedRestartPerms = true;
          }
          disableRestartTimer = true;
        }
      }

      if (restartCh && !disableRestartTimer) {
        const next = getNextRestartUtc(new Date());
        const until = next.getTime() - Date.now();
        const newRestartName = `🕛 Next Restart: ${formatCountdown(until)}`;

        if (restartCh && !restartLocked) {
          await lockVoiceChannel(restartCh, { logger });
          restartLocked = true;
        }

        if (newRestartName !== lastRestartName && restartCh.name !== newRestartName) {
          await restartCh
            .setName(newRestartName, "Auto-updating next restart countdown (GMT/UTC)")
            .catch((e) => {
              logger?.warn?.(`Failed to rename restart timer channel: ${e?.code ?? ""} ${e?.message ?? e}`);
              if (e?.code === 50001 || e?.code === 50013) disableRestartTimer = true;
            });
        }
        lastRestartName = newRestartName;
      }
    } catch (e) {
      logger?.warn?.(`Player count update failed: ${e?.message ?? e}`);
      // Best-effort: show unknown if we can
      try {
        const ch = await client.channels.fetch(playerCountChannelId).catch(() => null);
        if (ch) {
          const unknownName = "🦖 Players: ?";
          if (unknownName !== lastPlayerName && ch.name !== unknownName) {
            await ch.setName(unknownName, "RCON unavailable").catch(() => { });
          }
          lastPlayerName = unknownName;
        }
      } catch { }
    } finally {
      running = false;
    }
  }

  tick();
  setInterval(tick, intervalMs);
}
