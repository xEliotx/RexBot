function parsePlayersResponse(raw) {
    const text = String(raw || "").trim();
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 3) {
        return [];
    }

    const steamIds = lines[1]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    const names = lines[2]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    const players = [];

    for (let i = 0; i < steamIds.length; i++) {
        players.push({
            steamId: steamIds[i],
            name: names[i] || "Unknown",
        });
    }

    return players;
}

function parseSpeciesFromPlayerData(raw) {
    const text = String(raw || "");

    const matches = [...text.matchAll(/Class:\s*([^,\r\n]+)/gi)];

    return matches.map((match) => match[1].trim()).filter(Boolean);
}

export async function getSpeciesPopulation(rcon) {
    const playersRaw = await rcon.sendCommand("players");
    const players = parsePlayersResponse(playersRaw);

    if (!players.length) {
        return {};
    }

    const ids = players.map((player) => player.steamId);
    const playerDataRaw = await rcon.sendCommand("playerdata", ...ids);

    const speciesList = parseSpeciesFromPlayerData(playerDataRaw);

    const counts = {};

    for (const species of speciesList) {
        counts[species] = (counts[species] || 0) + 1;
    }

    return counts;
}