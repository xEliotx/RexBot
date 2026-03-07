// Updates a dedicated voice channel name with the current server status.
// 🟢 = RCON responds
// 🔴 = RCON fails / times out

async function lockVoiceChannel(channel, { logger } = {}) {
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

  const everyoneRoleId = channel.guild.roles.everyone.id;
  try {
    await channel.permissionOverwrites.edit(
      everyoneRoleId,
      { Connect: false },
      { reason: "Auto-lock stat voice channel on startup" }
    );
  } catch (e) {
    logger?.warn?.(`Failed to lock status channel ${channel?.id}: ${e?.code ?? ""} ${e?.message ?? e}`);
  }
}

export function startServerStatusUpdater({ client, rcon, config, logger }) {
  const channelId = (config.channels.serverStatusChannelId ?? "").trim();
  if (!channelId) {
    logger?.warn?.("SERVER_STATUS_CHANNEL_ID not set; skipping server status updater.");
    return;
  }

  const intervalMs = Number(process.env.SERVER_STATUS_UPDATE_MS ?? 60_000);
  let lastName = null;
  let running = false;
  let locked = false;
  let warnedPerms = false;
  let disabled = false;

  async function tick() {
    if (disabled) return;
    if (running) return;
    running = true;

    try {
      const ch = await client.channels.fetch(channelId).catch((e) => {
        logger?.warn?.(`Failed to fetch status channel ${channelId}: ${e?.code ?? ""} ${e?.message ?? e}`);
        return null;
      });

      if (!ch) {
        disabled = true;
        return;
      }

      if (ch.guild) {
        const me = ch.guild.members.me ?? (await ch.guild.members.fetchMe().catch(() => null));
        const perms = me ? ch.permissionsFor(me) : null;
        if (!perms?.has?.(["ViewChannel", "ManageChannels"])) {
          if (!warnedPerms) {
            logger?.warn?.(
              `Cannot manage server status channel ${channelId}: missing ViewChannel/ManageChannels (bot perms: ${perms?.toArray?.().join(", ") ?? "unknown"})`
            );
            warnedPerms = true;
          }
          disabled = true;
          return;
        }
      }

      if (!locked) {
        await lockVoiceChannel(ch, { logger });
        locked = true;
      }

      let online = false;
      try {
        // Use a real query, since you confirmed srv:details responds reliably.
        await rcon.sendCommand("srv:details");
        online = true;
      } catch {
        online = false;
      }

      const newName = online ? "Server Status: 🟢" : "Server Status: 🟢";
      if (newName !== lastName && ch.name !== newName) {
        await ch
          .setName(newName, "Auto-updating server status (Evrima)")
          .catch((e) => {
            logger?.warn?.(`Failed to rename status channel: ${e?.code ?? ""} ${e?.message ?? e}`);
            if (e?.code === 50001 || e?.code === 50013) disabled = true;
          });
      }
      lastName = newName;
    } finally {
      running = false;
    }
  }

  tick();
  setInterval(tick, intervalMs);
}
