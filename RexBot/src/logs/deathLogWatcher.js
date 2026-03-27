import fs from "node:fs";
import path from "node:path";
import { EmbedBuilder } from "discord.js";
import speciesEmojis from "../../config/speciesEmojis.js";

function toPercent(value) {
    return Math.round(Number(value) * 100);
}

function getSpeciesEmoji(species) {
    return speciesEmojis[species] || "🦖";
}

function parsePvpKillLine(line) {
    const match = line.match(
        /LogTheIsleKillData:\s+\[[^\]]+\]\s+(.+?)\s+\[(\d+)\]\s+Dino:\s+([^,]+),\s+([^,]+),\s+([\d.]+)\s+-\s+Killed the following player:\s+(.+?),\s+\[(\d+)\],\s+Dino:\s+([^,]+),\s+Gender:\s+([^,]+),\s+Growth:\s+([\d.]+)/i
    );

    if (!match) return null;

    const [
        ,
        killerName,
        killerSteamId,
        killerSpecies,
        killerSex,
        killerGrowth,
        victimName,
        victimSteamId,
        victimSpecies,
        victimSex,
        victimGrowth,
    ] = match;

    return {
        type: "pvp",
        killer: {
            name: killerName.trim(),
            steamId: killerSteamId.trim(),
            species: killerSpecies.trim(),
            sex: killerSex.trim(),
            growth: toPercent(killerGrowth),
        },
        victim: {
            name: victimName.trim(),
            steamId: victimSteamId.trim(),
            species: victimSpecies.trim(),
            sex: victimSex.trim(),
            growth: toPercent(victimGrowth),
        },
    };
}

function parseNaturalDeathLine(line) {
    const match = line.match(
        /LogTheIsleKillData:\s+\[[^\]]+\]\s+(.+?)\s+\[(\d+)\]\s+Dino:\s+([^,]+),\s+([^,]+),\s+([\d.]+)\s+-\s+Died from\s+(.+)$/i
    );

    if (!match) return null;

    const [, playerName, steamId, species, sex, growth, cause] = match;

    return {
        type: "natural",
        player: {
            name: playerName.trim(),
            steamId: steamId.trim(),
            species: species.trim(),
            sex: sex.trim(),
            growth: toPercent(growth),
        },
        cause: cause.trim(),
    };
}

function parseDeathLogLine(line) {
    return parsePvpKillLine(line) || parseNaturalDeathLine(line);
}

function buildDeathEmbed(event) {
    const gap = "\u2003"; // em space

    if (event.type === "pvp") {
        const killerEmoji = getSpeciesEmoji(event.killer.species);
        const victimEmoji = getSpeciesEmoji(event.victim.species);

        return new EmbedBuilder()
            .setColor(0xed4245)
            .setDescription(
                `${killerEmoji}${gap}**${event.killer.species}** \`${event.killer.growth}%\`${gap}⚔️${gap}` +
                `${victimEmoji}${gap}**${event.victim.species}** \`${event.victim.growth}%\``
            );
    }

    const emoji = getSpeciesEmoji(event.player.species);

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(
            `${emoji}${gap}**${event.player.species}** \`${event.player.growth}%\`${gap}☠️${gap}${event.cause}`
        );
}

export async function startDeathLogWatcher({
    client,
    logFilePath,
    channelId,
    logger,
    interval = 3000,
}) {
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
        throw new Error("Death log channel not found or not text-based");
    }

    let lastSize = 0;
    let remainder = "";

    try {
        const stats = fs.statSync(logFilePath);
        console.log("death watcher poll", { lastSize, currentSize: stats.size });
        lastSize = stats.size;
        logger?.info?.(`Death log watcher started: ${logFilePath}`);
    } catch (err) {
        logger?.error?.("Could not read death log file:", err);
        return;
    }

    async function poll() {
        try {
            const stats = fs.statSync(logFilePath);

            if (stats.size < lastSize) {
                lastSize = stats.size;
                remainder = "";
                return;
            }

            if (stats.size === lastSize) return;

            const stream = fs.createReadStream(logFilePath, {
                start: lastSize,
                end: stats.size,
                encoding: "utf8",
            });

            let chunk = "";

            stream.on("data", (data) => {
                chunk += data;
            });

            stream.on("end", async () => {
                lastSize = stats.size;

                const combined = remainder + chunk;
                console.log("NEW LOG CHUNK:\n", chunk);
                const lines = combined.split(/\r?\n/);
                remainder = lines.pop() || "";

                for (const line of lines) {
                    console.log("CHECKING LINE:", line);
                    if (!line.includes("LogTheIsleKillData:")) continue;

                    const event = parseDeathLogLine(line);
                    if (!event) continue;

                    const embed = buildDeathEmbed(event);
                    await channel.send({ embeds: [embed] });
                }
            });
        } catch (err) {
            logger?.error?.("Death log watcher error:", err);
        }
    }

    setInterval(poll, interval);
}