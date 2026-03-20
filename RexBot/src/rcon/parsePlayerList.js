export function parsePlayerList(rawText) {
    if (!rawText || typeof rawText !== "string") return [];

    return rawText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes("Name:") && line.includes("PlayerID:"))
        .map((line) => {
            const nameMatch = line.match(/Name:\s*(.*?),\s*PlayerID:/);
            const idMatch = line.match(/PlayerID:\s*(\d+)/);

            if (!nameMatch || !idMatch) return null;

            return {
                name: nameMatch[1].trim(),
                playerId: idMatch[1].trim(),
            };
        })
        .filter(Boolean);
}