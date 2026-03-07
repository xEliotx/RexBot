function parsePlayers(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  // Expected format:
  // PlayerList
  // steamid1,steamid2,steamid3,
  // name1,name2,name3,
  const idLine = lines[1];

  return idLine
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function parseRestartHoursUtc() {
  const raw = String(process.env.RESTART_HOURS_UTC ?? "9,15,22").trim();

  const hours = raw
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 23);

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

function withTimeout(promise, ms, label = "Operation") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function lockVoiceChannel(channel, { logger } = {}) {
  if (!channel?.guild) return;

  const me =
    channel.guild.members.me ??
    (await channel.guild.members.fetchMe().catch(() => null));
  if (!me) return;

  const perms = channel.permissionsFor(me);
  if (!perms?.has?.(["ViewChannel", "ManageChannels"])) {
    logger?.warn?.(
      `Skipping lock for channel ${channel?.id}: missing ViewChannel/ManageChannels (bot perms: ${perms?.toArray?.().join(", ") ?? "unknown"})`
    );
    return;
  }

  const everyoneRoleId = channel.guild.roles.everyone.id;

  try {
    await channel.permissionOverwrites.edit(
      everyoneRoleId,
      { Connect: false },
      { reason: "Auto-lock stat voice channel on startup" }
    );
  } catch (e) {
    logger?.warn?.(
      `Failed to lock channel ${channel?.id}: ${e?.code ?? ""} ${e?.message ?? e}`
    );
  }
}

export function startPlayerCountUpdater({ client, rcon, config, logger }) {
  const playerCountChannelId = config.channels.playerCountChannelId;
  const restartTimerChannelId = config.channels.restartTimerChannelId;

  const playerIntervalMs = Number(process.env.PLAYER_COUNT_UPDATE_MS ?? 300000);
  const restartIntervalMs = Number(process.env.RESTART_TIMER_UPDATE_MS ?? 300000);
  const rconTimeoutMs = Number(process.env.RCON_QUERY_TIMEOUT_MS ?? 10000);

  let lastPlayerName = null;
  let lastRestartName = null;

  let playerRunning = false;
  let restartRunning = false;

  let playerLocked = false;
  let restartLocked = false;

  let warnedPlayerPerms = false;
  let warnedRestartPerms = false;

  let disablePlayerCount = false;
  let disableRestartTimer = false;

  async function fetchManagedChannel(channelId, label) {
    if (!channelId) return null;

    const channel = await client.channels.fetch(channelId).catch((e) => {
      logger?.warn?.(
        `Failed to fetch ${label} channel ${channelId}: ${e?.code ?? ""} ${e?.message ?? e}`
      );
      return null;
    });

    return channel;
  }

  async function ensureManageable(channel, label, warnedFlagSetter) {
    if (!channel?.guild) return true;

    const me =
      channel.guild.members.me ??
      (await channel.guild.members.fetchMe().catch(() => null));
    const perms = me ? channel.permissionsFor(me) : null;

    if (!perms?.has?.(["ViewChannel", "ManageChannels"])) {
      warnedFlagSetter(
        `Cannot manage ${label} channel ${channel.id}: missing ViewChannel/ManageChannels (bot perms: ${perms?.toArray?.().join(", ") ?? "unknown"})`
      );
      return false;
    }

    return true;
  }

  async function updatePlayerCount() {
    if (disablePlayerCount || playerRunning) return;

    if (!playerCountChannelId) {
      logger?.warn?.("PLAYER_COUNT_CHANNEL_ID not set; skipping player count updater.");
      disablePlayerCount = true;
      return;
    }

    playerRunning = true;

    try {
      const playerCh = await fetchManagedChannel(playerCountChannelId, "player count");
      if (!playerCh) {
        disablePlayerCount = true;
        return;
      }

      const manageable = await ensureManageable(playerCh, "player count", (msg) => {
        if (!warnedPlayerPerms) {
          logger?.warn?.(msg);
          warnedPlayerPerms = true;
        }
      });

      if (!manageable) {
        disablePlayerCount = true;
        return;
      }

      if (!playerLocked) {
        await lockVoiceChannel(playerCh, { logger });
        playerLocked = true;
      }

      let raw;
      try {
        raw = await withTimeout(
          rcon.sendRaw("playerlist"),
          rconTimeoutMs,
          "RCON playerlist"
        );
      } catch {
        raw = await withTimeout(
          rcon.sendRaw("players"),
          rconTimeoutMs,
          "RCON players"
        );
      }

      const count = parsePlayers(raw).length;
      const newPlayerName = `🦖 Players: ${count}`;

      if (newPlayerName !== lastPlayerName && playerCh.name !== newPlayerName) {
        await playerCh
          .setName(newPlayerName, "Auto-updating Evrima player count")
          .catch((e) => {
            logger?.warn?.(
              `Failed to rename player count channel: ${e?.code ?? ""} ${e?.message ?? e}`
            );
            if (e?.code === 50001 || e?.code === 50013) {
              disablePlayerCount = true;
            }
          });
      }

      lastPlayerName = newPlayerName;
    } catch (e) {
      logger?.warn?.(`Player count update failed: ${e?.message ?? e}`);

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
      playerRunning = false;
    }
  }

  async function updateRestartTimer() {
    if (disableRestartTimer || restartRunning) return;

    if (!restartTimerChannelId) {
      logger?.warn?.("RESTART_TIMER_CHANNEL_ID not set; skipping restart timer updater.");
      disableRestartTimer = true;
      return;
    }

    restartRunning = true;

    try {
      const restartCh = await fetchManagedChannel(restartTimerChannelId, "restart timer");
      if (!restartCh) {
        disableRestartTimer = true;
        return;
      }

      const manageable = await ensureManageable(restartCh, "restart timer", (msg) => {
        if (!warnedRestartPerms) {
          logger?.warn?.(msg);
          warnedRestartPerms = true;
        }
      });

      if (!manageable) {
        disableRestartTimer = true;
        return;
      }

      if (!restartLocked) {
        await lockVoiceChannel(restartCh, { logger });
        restartLocked = true;
      }

      const next = getNextRestartUtc(new Date());
      const until = next.getTime() - Date.now();
      const newRestartName = `🕛 Next Restart: ${formatCountdown(until)}`;

      if (newRestartName !== lastRestartName && restartCh.name !== newRestartName) {
        await restartCh
          .setName(newRestartName, "Auto-updating next restart countdown (GMT/UTC)")
          .catch((e) => {
            logger?.warn?.(
              `Failed to rename restart timer channel: ${e?.code ?? ""} ${e?.message ?? e}`
            );
            if (e?.code === 50001 || e?.code === 50013) {
              disableRestartTimer = true;
            }
          });
      }

      lastRestartName = newRestartName;
    } catch (e) {
      logger?.warn?.(`Restart timer update failed: ${e?.message ?? e}`);
    } finally {
      restartRunning = false;
    }
  }

  updatePlayerCount();
  updateRestartTimer();

  setInterval(updatePlayerCount, playerIntervalMs);
  setInterval(updateRestartTimer, restartIntervalMs);
}