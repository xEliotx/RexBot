import { ActivityType } from "discord.js";

export function startPresenceRotator({ client, rcon, logger }) {
    const staticStatuses = [
        {
            type: ActivityType.Playing,
            text: "Playing The Isle Evrima",
            status: "online",
        },
        {
            type: ActivityType.Watching,
            text: "Watching Blood & Bone Discord",
            status: "online",
        },
        {
            type: ActivityType.Listening,
            text: "Listening to Rooooooooar",
            status: "idle",
        },
    ];

    let index = 0;

    function parsePlayerCount(raw) {
        const text = String(raw ?? "").trim();
        if (!text) return 0;

        const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (lines.length < 2) return 0;

        if (lines[0].toLowerCase() !== "playerlist") return 0;

        const ids = lines[1]
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

        return ids.length;
    }

    async function getDynamicStatus() {
        try {
            const raw = await rcon.sendCommand("playerlist");
            const playerCount = parsePlayerCount(raw);

            return {
                type: ActivityType.Watching,
                text: `${playerCount} dinosaur${playerCount === 1 ? "" : "s"} Surving`,
                status: "online",
            };
        } catch (error) {
            logger?.warn?.(`[presence] failed to fetch player count: ${error.message}`);
            return null;
        }
    }

    async function applyPresence() {
        const useDynamic = index % 4 === 3; // every 4th rotation use live player count

        let current = null;

        if (useDynamic) {
            current = await getDynamicStatus();
        }

        if (!current) {
            current = staticStatuses[index % staticStatuses.length];
        }

        try {
            await client.user.setPresence({
                status: current.status,
                activities: [
                    {
                        name: current.text,
                        type: current.type,
                    },
                ],
            });
        } catch (error) {
            logger?.warn?.(`[presence] failed to set presence: ${error.message}`);
        }

        index += 1;
    }

    applyPresence();
    setInterval(() => {
        applyPresence().catch((error) => {
            logger?.warn?.(`[presence] rotation error: ${error.message}`);
        });
    }, 300_000); // every 5 minutes
}