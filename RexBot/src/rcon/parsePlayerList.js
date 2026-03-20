export function parsePlayerList(rawText) {
    if (!rawText || typeof rawText !== "string") return [];

    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) return [];

    // Remove header line if present
    if (lines[0].toLowerCase() === "playerlist") {
        lines.shift();
    }

    const players = [];

    for (let i = 0; i < lines.length; i += 2) {
        const playerId = String(lines[i] || "").replace(/,+$/, "").trim();
        const name = String(lines[i + 1] || "").replace(/,+$/, "").trim();

        if (!playerId || !name) continue;

        players.push({
            playerId,
            name,
        });
    }

    return players;
}