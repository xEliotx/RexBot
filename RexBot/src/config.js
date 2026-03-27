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
    playerCountChannelId: optional("PLAYER_COUNT_CHANNEL_ID"),
    serverStatusChannelId: optional("SERVER_STATUS_CHANNEL_ID", optional("VOICE_STATUS_CHANNEL_ID", "")),
    restartTimerChannelId: process.env.RESTART_TIMER_CHANNEL_ID,
    ticketCategoryId: must("TICKET_CATEGORY_ID"),
    ticketStaffRoleId: optional("TICKET_STAFF_ROLE_ID", ""),
    ticketInactivityHours: Number(process.env.TICKET_INACTIVITY_HOURS ?? 48),
    ticketInactivityCheckMinutes: Number(process.env.TICKET_INACTIVITY_CHECK_MINUTES ?? 10),
    ticketWarnBeforeHours: Number(process.env.TICKET_WARN_BEFORE_HOURS ?? 1),
    ticketLogsChannelId: optional("TICKET_LOGS_CHANNEL_ID", ""),
    ticketCloseDmEnabled: optional("TICKET_CLOSE_DM_ENABLED", "false").toLowerCase() === "true",
  },
  dinoRoles: {
  allo: optional("ROLE_ALLO_ID", ""),
  beipiao: optional("ROLE_BEIPIAO_ID", ""),
  carno: optional("ROLE_CARNO_ID", ""),
  cerato: optional("ROLE_CERATO_ID", ""),
  deino: optional("ROLE_DEINO_ID", ""),
  diablo: optional("ROLE_DIABLO_ID", ""),
  dilo: optional("ROLE_DILO_ID", ""),
  dryo: optional("ROLE_DRYO_ID", ""),
  galli: optional("ROLE_GALLI_ID", ""),
  herrera: optional("ROLE_HERRERA_ID", ""),
  hypsi: optional("ROLE_HYPSI_ID", ""),
  maia: optional("ROLE_MAIA_ID", ""),
  omni: optional("ROLE_OMNI_ID", ""),
  pachy: optional("ROLE_PACHY_ID", ""),
  ptera: optional("ROLE_PTERA_ID", ""),
  rex: optional("ROLE_REX_ID", ""),
  stego: optional("ROLE_STEGO_ID", ""),
  teno: optional("ROLE_TENO_ID", ""),
  trike: optional("ROLE_TRIKE_ID", ""),
  troodon: optional("ROLE_TROODON_ID", ""),
},
  rcon: {
    host: must("RCON_HOST"),
    port: Number(must("RCON_PORT")),
    password: must("RCON_PASSWORD"),
  },
};
