export function parsePlayerList(rawText) {
    if (!rawText || typeof rawText !== "string") return [];

    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 3) return [];

    const header = lines[0].toLowerCase();
    if (header !== "playerlist") return [];

    const ids = lines[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    const names = lines[2]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    const count = Math.min(ids.length, names.length);
    const players = [];

    for (let i = 0; i < count; i += 1) {
        players.push({
            playerId: ids[i],
            name: names[i],
        });
    }

    return players;
}