// src/ftp/safelog.js
// Reads Evrima server logs over FTP and extracts the latest SafeLog snapshot for a Steam64.

import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { withFtp } from "./ftpClient.js";

// Example line (from your server):
// [2026.01.28-19.06.04:798][352]LogTheIsleJoinData: [20:6] RUXY [76561198811041864] Left The Server whilebeing safelogged, Was playing as: Dilophosaurus, Gender: Male, Growth: 1.000000

const SAFELOG_RE = /\[(?<date>\d{4})\.(?<mon>\d{2})\.(?<day>\d{2})-(?<hour>\d{2})\.(?<min>\d{2})\.(?<sec>\d{2}):(?<ms>\d+)\]\[\d+\]LogTheIsleJoinData:.*?\s(?<name>.+?)\s\[(?<steam64>\d{17})\]\sLeft The Server whilebeing safelogged,\s*Was playing as:\s*(?<species>[A-Za-z_]+),\s*Gender:\s*(?<gender>[A-Za-z]+),\s*Growth:\s*(?<growth>\d+(?:\.\d+)?)/g;

function toUtcIsoFromParts(m) {
  try {
    const y = Number(m.groups.date);
    const mo = Number(m.groups.mon);
    const d = Number(m.groups.day);
    const h = Number(m.groups.hour);
    const mi = Number(m.groups.min);
    const s = Number(m.groups.sec);
    const ms = Number(String(m.groups.ms).slice(0, 3).padEnd(3, "0"));
    // Treat log timestamp as local server time.
    const dt = new Date(y, mo - 1, d, h, mi, s, ms);
    return dt.toISOString();
  } catch {
    return null;
  }
}

function parseSafelogEntries(text) {
  const out = [];
  const s = String(text ?? "");
  for (const match of s.matchAll(SAFELOG_RE)) {
    const steam64 = match.groups?.steam64;
    if (!steam64) continue;
    out.push({
      steam64,
      playerName: match.groups?.name?.trim() ?? null,
      species: match.groups?.species?.trim() ?? null,
      gender: match.groups?.gender?.trim() ?? null,
      growth: Number(match.groups?.growth ?? NaN),
      at: toUtcIsoFromParts(match),
    });
  }
  return out;
}

async function downloadText(client, remotePath) {
  const tmpLocal = path.join(
    os.tmpdir(),
    `rexbot_log_${Date.now()}_${Math.random().toString(16).slice(2)}.log`
  );
  await client.downloadTo(tmpLocal, remotePath);
  const buf = await fs.readFile(tmpLocal);
  await fs.unlink(tmpLocal).catch(() => {});
  // Logs are typically UTF-8.
  return buf.toString("utf8");
}

function isFresh(atIso, maxAgeMinutes) {
  if (!atIso) return false;
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return false;
  const ageMs = Date.now() - t;
  return ageMs >= 0 && ageMs <= maxAgeMinutes * 60_000;
}

export async function getLatestSafelogForSteam64({ ftpConfig, logsDir, steam64, maxAgeMinutes = 10, maxFiles = 50 }) {
  const target = String(steam64 ?? "").trim();
  if (!/^\d{17}$/.test(target)) throw new Error("steam64 required");

  return await withFtp(ftpConfig, async (client) => {
    const list = await client.list(logsDir);
    // Prefer most recently modified files first.
    const files = list
      .filter((e) => e?.isFile || e?.type === 1 || e?.type === "-" )
      .sort((a, b) => {
        const am = a.modifiedAt ? a.modifiedAt.getTime() : 0;
        const bm = b.modifiedAt ? b.modifiedAt.getTime() : 0;
        return bm - am;
      })
      .slice(0, maxFiles);

    let best = null;

    for (const f of files) {
      const remote = `${logsDir.replace(/\/$/, "")}/${f.name}`;
      let text;
      try {
        text = await downloadText(client, remote);
      } catch {
        continue;
      }

      const entries = parseSafelogEntries(text)
        .filter((e) => e.steam64 === target && e.species)
        .sort((a, b) => {
          const at = Date.parse(a.at ?? "") || 0;
          const bt = Date.parse(b.at ?? "") || 0;
          return bt - at;
        });

      if (!entries.length) continue;
      const candidate = entries[0];

      // If it isn't fresh, keep looking (maybe another newer file has it)
      if (!isFresh(candidate.at, maxAgeMinutes)) {
        if (!best) best = candidate; // keep a fallback so we can show “too old” details
        continue;
      }

      best = candidate;
      break;
    }

    return best;
  });
}
