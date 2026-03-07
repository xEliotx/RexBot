// src/ftp/bans.js
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { withFtp } from "./ftpClient.js";

function decodeTextAuto(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf ?? []);

  // UTF-16 BOM detection
  if (buf.length >= 2) {
    const b0 = buf[0], b1 = buf[1];
    // UTF-16LE BOM: FF FE
    if (b0 === 0xff && b1 === 0xfe) {
      return buf.slice(2).toString("utf16le");
    }
    // UTF-16BE BOM: FE FF (convert by swapping)
    if (b0 === 0xfe && b1 === 0xff) {
      const swapped = Buffer.alloc(buf.length - 2);
      for (let i = 2; i + 1 < buf.length; i += 2) {
        swapped[i - 2] = buf[i + 1];
        swapped[i - 1] = buf[i];
      }
      return swapped.toString("utf16le");
    }
  }

  // Heuristic: lots of 0x00 bytes => probably UTF-16LE without BOM
  let zeros = 0;
  for (let i = 0; i < Math.min(buf.length, 2000); i++) if (buf[i] === 0x00) zeros++;
  if (zeros > 50) {
    return buf.toString("utf16le");
  }

  // Default: UTF-8
  return buf.toString("utf8");
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function stripTrailingCommas(s) {
  return s.replace(/,\s*([}\]])/g, "$1");
}

function extractJSONObject(s) {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return s.slice(first, last + 1);
}

function safeJsonParseLenient(text) {
  let s = stripBom(String(text ?? "")).trim();

  // try strict
  try { return JSON.parse(s); } catch {}

  const extracted = extractJSONObject(s) ?? s;

  // try extracted strict
  try { return JSON.parse(extracted); } catch {}

  // sanitize
  const sanitized = stripTrailingCommas(stripComments(extracted)).trim();
  return JSON.parse(sanitized);
}

function normalizeBansDoc(doc) {
  if (!doc || typeof doc !== "object") return { bannedPlayerData: [] };
  if (!Array.isArray(doc.bannedPlayerData)) doc.bannedPlayerData = [];
  return doc;
}

async function downloadBufferToTempFile(client, remotePath) {
  const tmpLocal = path.join(
    os.tmpdir(),
    `rexbot_bans_${Date.now()}_${Math.random().toString(16).slice(2)}.bin`
  );
  await client.downloadTo(tmpLocal, remotePath);
  const buf = await fs.readFile(tmpLocal);
  await fs.unlink(tmpLocal).catch(() => {});
  return buf;
}

async function uploadAtomicBufferViaTempFile(client, remotePath, buf) {
  const tmpLocal = path.join(
    os.tmpdir(),
    `rexbot_bans_upload_${Date.now()}_${Math.random().toString(16).slice(2)}.json`
  );
  await fs.writeFile(tmpLocal, buf);

  const tmpRemote = `${remotePath}.tmp`;
  await client.uploadFrom(tmpLocal, tmpRemote);

  // move old aside then tmp->final
  try {
    const backupRemote = `${remotePath}.prebot.${Date.now()}`;
    await client.rename(remotePath, backupRemote);
  } catch {}

  await client.rename(tmpRemote, remotePath);
  await fs.unlink(tmpLocal).catch(() => {});
}

export async function unbanSteam64({ ftpConfig, bansFilePath, steam64 }) {
  if (!steam64 || !String(steam64).trim()) throw new Error("steam64 required");
  const target = String(steam64).trim();

  return await withFtp(ftpConfig, async (client) => {
    const rawBuf = await downloadBufferToTempFile(client, bansFilePath);
    const rawText = decodeTextAuto(rawBuf);

    let doc;
    try {
      doc = safeJsonParseLenient(rawText);
    } catch {
      const preview = rawText.slice(0, 200).replace(/\r?\n/g, "\\n");
      throw new Error(`Failed to parse bans file as JSON. Preview: "${preview}"`);
    }

    doc = normalizeBansDoc(doc);

    const before = doc.bannedPlayerData.length;
    doc.bannedPlayerData = doc.bannedPlayerData.filter(
      (b) => String(b?.steamId ?? "").trim() !== target
    );
    const after = doc.bannedPlayerData.length;
    const removed = before - after;

    if (removed <= 0) return { removed: 0, before, after };

    // Write back as UTF-8 JSON (server should accept this fine)
    const outText = JSON.stringify(doc, null, 2);
    const outBuf = Buffer.from(outText, "utf8");
    await uploadAtomicBufferViaTempFile(client, bansFilePath, outBuf);

    return { removed, before, after };
  });
}
