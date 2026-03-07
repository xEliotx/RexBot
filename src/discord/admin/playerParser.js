export function parsePlayers(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];

  // Normalize lines, keep ordering, drop empty, strip trailing commas.
  let lines = raw
    .split(/\r?\n/)
    .map((l) => String(l).trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/,+$/, ""));

  if (!lines.length) return [];

  // Drop header like "PlayerList"
  if (lines[0].toLowerCase().includes("playerlist")) {
    lines = lines.slice(1);
  }
  if (!lines.length) return [];

  const isSteam64 = (s) => /^\d{17}$/.test(s) || /^7656119\d{10,}$/.test(s);

  // Format A (CSV blocks):
  // <steam64,steam64,...>
  // <name,name,...>
  // NOTE: For large servers, IDs/names may wrap across multiple lines. We handle that by tokenizing.
  const hasComma = lines.some((l) => l.includes(","));
  if (hasComma) {
    const tokens = lines
      .join("\n")
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Find where the Steam64 list ends (first non-steam64 token)
    let splitIdx = tokens.findIndex((t) => !isSteam64(t));
    if (splitIdx === -1) splitIdx = tokens.length;

    const ids = tokens.slice(0, splitIdx).filter(isSteam64);
    const names = tokens.slice(splitIdx);

    const players = ids.map((steam64, i) => ({
      id: null,
      steam64,
      name: names[i] ?? "(unknown)",
      raw: `${steam64}, ${names[i] ?? "(unknown)"}`,
    }));

    // If we successfully parsed at least one player, return.
    if (players.length) return players;
    // else fall through to line-pair parsing.
  }

  // Format B (line pairs):
  // <steam64>
  // <name>
  const players = [];
  for (let i = 0; i < lines.length; i += 2) {
    const steam64 = lines[i] ?? "";
    const name = lines[i + 1] ?? "";
    if (!steam64 || !name) continue;
    if (!isSteam64(steam64)) continue;

    players.push({
      id: null,
      steam64,
      name,
      raw: `${steam64}, ${name}`,
    });
  }

  return players;
}
