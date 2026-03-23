import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { EmbedBuilder } from "discord.js";

const STORE_PATH = path.resolve(process.cwd(), "data", "statusMessage.json");

const SERVER_INFO = {
    map: "Gateway",
    location: "Europe",
    type: "Unofficial",
    growthSpeed: "1.25x",
    maxPlayers: 200,
};

function makeBar(current, max, size = 10) {
    if (!max || max <= 0) return "░".repeat(size);

    const ratio = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * size);

    return "█".repeat(filled) + "░".repeat(size - filled);
}

function parsePlayers(raw) {
    const text = String(raw ?? "").trim();
    if (!text) return [];

    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    if (lines.length < 2) return [];

    const idLine = lines[1];
    return idLine
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
}

function parseRestartHoursUtc() {
    const raw = String(process.env.RESTART_HOURS_UTC ?? "0,6,12,18").trim();
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

function formatUtcTime(date) {
    return (
        date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
            hour12: false,
        }) + " GMT"
    );
}

function withTimeout(promise, ms, label = "Operation") {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        ),
    ]);
}

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

async function lockStatusChannel(channel) {
    if (!channel?.guild) return;
    const everyoneRoleId = channel.guild.roles.everyone.id;

    await channel.permissionOverwrites.edit(
        everyoneRoleId,
        {
            SendMessages: false,
            SendMessagesInThreads: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            AddReactions: false,
        },
        { reason: "Lock server status channel" }
    );
}

function buildStatusEmbed({ online, restarting, playerCount, nextRestart, nowUtc, lastSeenOnline }) {
    const countdown = formatCountdown(nextRestart.getTime() - nowUtc.getTime());
    const restartTime = formatUtcTime(nextRestart);
    const updatedTime = formatUtcTime(nowUtc);

    let statusLine;
    let color;

    if (online) {
        statusLine = "🟢 **SERVER ONLINE**";
        color = 0x2ecc71;
    } else if (restarting) {
        statusLine = "🟠 **SERVER RESTARTING**";
        color = 0xf39c12;
    } else {
        statusLine = "🔴 **SERVER OFFLINE**";
        color = 0xe74c3c;
    }

    const safePlayerCount = online && playerCount != null ? playerCount : 0;
    const capacityPercent =
        SERVER_INFO.maxPlayers > 0
            ? Math.round((safePlayerCount / SERVER_INFO.maxPlayers) * 100)
            : 0;

    const capacityBar = makeBar(safePlayerCount, SERVER_INFO.maxPlayers, 10);

    return new EmbedBuilder()
        .setTitle("🦖 Blood & Bone: The Mesozoic")
        .setColor(color)
        .setImage("https://cdn.discordapp.com/attachments/778652435227869214/1485683137769111673/Server_Stats.png?ex=69c2c1be&is=69c1703e&hm=a2bea10770813c1f27fe555508990628caa6d2330f968b298ab7f08a3e6e89c1&")
        .setDescription(
            `${statusLine}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `**Live Evrima server monitor**\n` +
            `Tracking player count, restart cycle, and server availability.\n` +
            `━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
            {
                name: "👥 Players",
                value: online
                    ? `**${playerCount == null ? "Unknown" : playerCount} / ${SERVER_INFO.maxPlayers}**`
                    : `**Unknown / ${SERVER_INFO.maxPlayers}**`,
                inline: true,
            },
            {
                name: "📊 Capacity",
                value: `\`${capacityBar}\`\n**${capacityPercent}%**`,
                inline: true,
            },
            {
                name: "\u200B",
                value: "\u200B",
                inline: true,
            },

            {
                name: "⏰ Next Restart",
                value: `**${restartTime}**`,
                inline: true,
            },
            {
                name: "⌛ Countdown",
                value: `**${countdown}**`,
                inline: true,
            },
            {
                name: "\u200B",
                value: "\u200B",
                inline: true,
            },

            {
                name: "🗺️ Map",
                value: `**${SERVER_INFO.map}**`,
                inline: true,
            },
            {
                name: "🌱 Growth Speed",
                value: `**${SERVER_INFO.growthSpeed}**`,
                inline: true,
            },
            {
                name: "\u200B",
                value: "\u200B",
                inline: true,
            },

            {
                name: "🌍 Location",
                value: `**${SERVER_INFO.location}**`,
                inline: true,
            },
            {
                name: "🌍 Time Zone",
                value: "`GMT`",
                inline: true,
            },
            {
                name: "\u200B",
                value: "\u200B",
                inline: true,
            }
        )
        .setTimestamp(nowUtc);
}

function hasMeaningfulChange(current, previous) {
    if (!previous) return true;

    return (
        current.online !== previous.online ||
        current.restarting !== previous.restarting ||
        current.playerCount !== previous.playerCount ||
        current.nextRestart !== previous.nextRestart ||
        current.lastSeenOnline !== previous.lastSeenOnline
    );
}

export function startStatusEmbedUpdater({ client, rcon, logger }) {
    const channelId = String(process.env.STATUS_CHANNEL_ID ?? "").trim();
    const intervalMs = Number(process.env.STATUS_UPDATE_MS ?? 30000);
    const timeoutMs = Number(process.env.RCON_QUERY_TIMEOUT_MS ?? 10000);
    const failuresBeforeOffline = Number(process.env.STATUS_FAILURES_BEFORE_OFFLINE ?? 2);
    const forceRefreshMs = Number(process.env.STATUS_FORCE_REFRESH_MS ?? 300000);

    if (!channelId) {
        logger?.warn?.("STATUS_CHANNEL_ID not set; skipping status embed updater.");
        return;
    }

    let running = false;
    let locked = false;
    let consecutiveFailures = 0;
    let lastKnownOnline = false;
    let lastKnownPlayerCount = null;
    let lastSeenOnline = null;
    let lastPublishedState = null;
    let lastPublishAt = 0;

    async function queryServer() {
        if (!rcon.connected) {
            await withTimeout(rcon.connect(), timeoutMs, "RCON connect");
        }

        await withTimeout(rcon.sendCommand("srv:details"), timeoutMs, "RCON srv:details");

        let raw;
        try {
            raw = await withTimeout(rcon.sendRaw("playerlist"), timeoutMs, "RCON playerlist");
        } catch {
            raw = await withTimeout(rcon.sendRaw("players"), timeoutMs, "RCON players");
        }

        return parsePlayers(raw).length;
    }

    async function tick() {
        if (running) return;
        running = true;

        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                logger?.warn?.(`Status channel not found or not text-based: ${channelId}`);
                return;
            }

            if (!locked) {
                await lockStatusChannel(channel).catch(() => { });
                locked = true;
            }

            let online = false;
            let restarting = false;
            let playerCount = null;

            try {
                playerCount = await queryServer();
                online = true;

                consecutiveFailures = 0;
                lastKnownOnline = true;
                lastKnownPlayerCount = playerCount;
                lastSeenOnline = new Date();
            } catch (err) {
                consecutiveFailures++;

                // Keep the last known good state for a brief hiccup.
                if (consecutiveFailures < failuresBeforeOffline) {
                    online = lastKnownOnline;
                    playerCount = lastKnownPlayerCount;
                } else {
                    online = false;
                    playerCount = null;
                    lastKnownOnline = false;
                    lastKnownPlayerCount = null;
                }

                try {
                    rcon.disconnect();
                } catch { }

                logger?.warn?.(
                    `Server query failed (${consecutiveFailures}/${failuresBeforeOffline}): ${err?.message ?? err}`
                );
            }

            const nowUtc = new Date();
            const nextRestart = getNextRestartUtc(nowUtc);
            const restartWindowMs = 5 * 60 * 1000;
            const timeToRestart = nextRestart.getTime() - nowUtc.getTime();

            if (!online && timeToRestart < restartWindowMs && timeToRestart > -restartWindowMs) {
                restarting = true;
            }

            const stateSnapshot = {
                online,
                restarting,
                playerCount,
                nextRestart: nextRestart.getTime(),
                lastSeenOnline: lastSeenOnline ? lastSeenOnline.getTime() : null
            };

            const shouldForceRefresh = Date.now() - lastPublishAt >= forceRefreshMs;
            const changed = hasMeaningfulChange(stateSnapshot, lastPublishedState);

            if (!changed && !shouldForceRefresh) {
                return; // ❌ no log spam
            }

            // ✅ ONLY log when actually updating
            logger?.info?.(
                `[status] updating → online=${online} restarting=${restarting} players=${playerCount ?? "unknown"}`
            );

            const embed = buildStatusEmbed({
                online,
                restarting,
                playerCount,
                nextRestart,
                nowUtc,
                lastSeenOnline,
            });

            const store = await loadStore();
            const messageId = store.messageId ?? null;

            if (messageId) {
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (msg && msg.author?.id === client.user.id) {
                    await msg.edit({ embeds: [embed] });
                    lastPublishedState = stateSnapshot;
                    lastPublishAt = Date.now();
                    logger?.debug?.("[status] embed updated");
                    return;
                }
            }

            const sent = await channel.send({ embeds: [embed] });
            store.messageId = sent.id;
            await saveStore(store);
            lastPublishedState = stateSnapshot;
            lastPublishAt = Date.now();
            logger?.info?.("[status] embed message created successfully");
        } catch (e) {
            logger?.warn?.(`Status embed update failed: ${e?.message ?? e}`);
        } finally {
            running = false;
        }
    }

    tick();
    setInterval(tick, intervalMs);
}