import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { EmbedBuilder } from "discord.js";

const STORE_PATH = path.resolve(process.cwd(), "data", "statusMessage.json");

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
    let serverStatusText;

    if (online) {
        statusLine = "🟢 **SERVER ONLINE**";
        color = 0x2ecc71;
        serverStatusText = "`Healthy / Responding`";
    } else if (restarting) {
        statusLine = "🟠 **SERVER RESTARTING**";
        color = 0xf39c12;
        serverStatusText = "`Restarting / No response yet`";
    } else {
        statusLine = "🔴 **SERVER OFFLINE**";
        color = 0xe74c3c;
        serverStatusText = "`Offline / No response`";
    }

    return new EmbedBuilder()
        .setTitle("🦖 Blood & Bone: The Mesozoic")
        .setColor(color)
        .setThumbnail("https://media.discordapp.net/attachments/778652435227869214/1479990510142885928/logo.png?ex=69ae0c12&is=69acba92&hm=483be62858f6f38f6e94e7fecf3509578f65e3c5907c1c6be5884f90a5621e23&=&format=webp&quality=lossless&width=960&height=960")
        .setDescription(
            `${statusLine}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `**Live Evrima server monitor**\n` +
            `Tracking player count, restart cycle, and server availability.\n` +
            `━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
            {
                name: "👥 Players Online",
                value: online ? (playerCount == null ? "`Unknown`" : `**${playerCount}**`) : "`Unknown`",
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
                name: "📡 Server Status",
                value: serverStatusText,
                inline: true,
            },
            {
                name: "🕒 Last Updated",
                value: updatedTime,
                inline: true,
            },
            {
                name: "🌍 Time Zone",
                value: "`GMT / UTC`",
                inline: true,
            }
        )
        .setFooter({
            text: online
                ? "Blood & Bone • Automated Server Monitor"
                : `Blood & Bone • Automated Server Monitor • Last seen online ${lastSeenOnline ? formatUtcTime(lastSeenOnline) : "Unknown"
                }`,
        })
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