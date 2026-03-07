// src/ftp/playerSaves.js
// Deletes Evrima player save files (.sav and .sav.bak) over FTP.

import { withFtp } from "./ftpClient.js";

async function tryRemove(client, remotePath) {
  try {
    await client.remove(remotePath);
    return true;
  } catch {
    return false;
  }
}

export async function deletePlayerSaveFiles({ ftpConfig, playerDataDir, steam64 }) {
  const id = String(steam64 ?? "").trim();
  if (!/^\d{17}$/.test(id)) throw new Error("steam64 required");

  const base = String(playerDataDir ?? "").trim().replace(/\/$/, "");
  if (!base) throw new Error("playerDataDir required");

  const sav = `${base}/${id}.sav`;
  const bak = `${base}/${id}.sav.bak`;

  return await withFtp(ftpConfig, async (client) => {
    const removedSav = await tryRemove(client, sav);
    const removedBak = await tryRemove(client, bak);
    return { removedSav, removedBak, sav, bak };
  });
}
