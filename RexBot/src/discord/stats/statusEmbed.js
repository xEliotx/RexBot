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
    return date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false,
    }) + " GMT";
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
        { SendMessages: false },
        { reason: "Lock server status channel" }
    );
}

function buildStatusEmbed({ online, playerCount, nextRestart, nowUtc }) {
    const countdown = formatCountdown(nextRestart.getTime() - nowUtc.getTime());
    const nextRestartText = formatUtcTime(nextRestart);
    const lastUpdatedText = formatUtcTime(nowUtc);

    return new EmbedBuilder()
        .setTitle("🦖 Blood & Bone — Live Server Status")
        .setColor(online ? 0x57f287 : 0xed4245)
        .setDescription(
            online
                ? "The server is currently **online** and reporting live data."
                : "The server is currently **offline** or not responding to RCON."
        )
        .addFields(
            {
                name: "🟢 Status",
                value: online ? "Online" : "Offline",
                inline: true,
            },
            {
                name: "👥 Players",
                value: online ? String(playerCount) : "?",
                inline: true,
            },
            {
                name: "⏰ Next Restart",
                value: nextRestartText,
                inline: true,
            },
            {
                name: "⌛ Countdown",
                value: countdown,
                inline: true,
            },
            {
                name: "🕒 Last Updated",
                value: lastUpdatedText,
                inline: true,
            }
        )
        .setFooter({ text: "Blood & Bone automated status feed" })
        .setTimestamp(nowUtc);
}

export function startStatusEmbedUpdater({ client, rcon, logger }) {
    const channelId = String(process.env.STATUS_CHANNEL_ID ?? "").trim();
    const intervalMs = Number(process.env.STATUS_UPDATE_MS ?? 60000);
    const timeoutMs = Number(process.env.RCON_QUERY_TIMEOUT_MS ?? 10000);

    if (!channelId) {
        logger?.warn?.("STATUS_CHANNEL_ID not set; skipping status embed updater.");
        return;
    }

    let running = false;
    let locked = false;

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
            let playerCount = 0;

            try {
                let raw;
                try {
                    raw = await withTimeout(rcon.sendRaw("playerlist"), timeoutMs, "RCON playerlist");
                } catch {
                    raw = await withTimeout(rcon.sendRaw("players"), timeoutMs, "RCON players");
                }

                playerCount = parsePlayers(raw).length;
                online = true;
            } catch {
                online = false;
            }

            const nowUtc = new Date();
            const nextRestart = getNextRestartUtc(nowUtc);
            const embed = buildStatusEmbed({ online, playerCount, nextRestart, nowUtc });

            const store = await loadStore();
            const messageId = store.messageId ?? null;

            if (messageId) {
                const msg = await channel.messages.fetch(messageId).catch(() => null);
                if (msg && msg.author?.id === client.user.id) {
                    await msg.edit({ embeds: [embed] });
                    return;
                }
            }

            const sent = await channel.send({ embeds: [embed] });
            store.messageId = sent.id;
            await saveStore(store);
        } catch (e) {
            logger?.warn?.(`Status embed update failed: ${e?.message ?? e}`);
        } finally {
            running = false;
        }
    }

    tick();
    setInterval(tick, intervalMs);
}