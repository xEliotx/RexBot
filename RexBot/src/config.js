import "dotenv/config";

function must(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return v.trim();
}

function optional(name, fallback = "") {
  const v = process.env[name];
  return v ? v.trim() : fallback;
}

export const config = {
  discord: {
    token: must("DISCORD_TOKEN"),
    clientId: must("DISCORD_CLIENT_ID"),
    guildId: must("DISCORD_GUILD_ID"),
    AUTO_ASSIGN_ROLE_ID: process.env.AUTO_ASSIGN_ROLE_ID,
  },
  roles: {
    adminRoleId: must("ADMIN_ROLE_ID"),
    adminReportRoleId: must("ADMIN_REPORT_ROLE_ID"),
  },
  channels: {
    adminChannelId: must("ADMIN_CHANNEL_ID"),
    linkChannelId: must("LINK_CHANNEL_ID"),
    auditChannelId: optional("AUDIT_CHANNEL_ID", ""),
    playerCountChannelId: optional("PLAYER_COUNT_CHANNEL_ID"),
    // Voice channel that shows server status (🟢 / 🔴)
    // Supports legacy VOICE_STATUS_CHANNEL_ID as a fallback.
    serverStatusChannelId: optional("SERVER_STATUS_CHANNEL_ID", optional("VOICE_STATUS_CHANNEL_ID", "")),
    restartTimerChannelId: optional("RESTART_TIMER_CHANNEL_ID"),
    tokensChannelId: must("TOKENS_CHANNEL_ID"),
    restoreRequestsChannelId: optional("RESTORE_REQUESTS_CHANNEL_ID", ""),
    ticketCategoryId: must("TICKET_CATEGORY_ID"),
    ticketStaffRoleId: optional("TICKET_STAFF_ROLE_ID", ""),
    ticketInactivityHours: Number(process.env.TICKET_INACTIVITY_HOURS ?? 48),
    ticketInactivityCheckMinutes: Number(process.env.TICKET_INACTIVITY_CHECK_MINUTES ?? 10),
    ticketWarnBeforeHours: Number(process.env.TICKET_WARN_BEFORE_HOURS ?? 1),


  },
  tokens: {
    imageUrl: optional("TOKEN_IMAGE_URL", ""),
    safelogMaxAgeMinutes: Number(optional("SAFELOG_MAX_AGE_MINUTES", "10")),
  },
  ftp: {
    host: must("FTP_HOST"),
    port: Number(optional("FTP_PORT", "21")),
    user: must("FTP_USER"),
    password: must("FTP_PASSWORD"),
    bansFilePath: must("BANS_FILE_PATH"),

    // Evrima server paths (FTP)
    logsDir: optional("FTP_LOGS_DIR", "/TheIsle/Saved/Logs"),
    playerDataDir: optional("FTP_PLAYERDATA_DIR", "/TheIsle/Saved/PlayerData"),
  },
  rcon: {
    host: must("RCON_HOST"),
    port: Number(must("RCON_PORT")),
    password: must("RCON_PASSWORD"),
  },
};
