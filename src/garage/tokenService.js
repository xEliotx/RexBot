import crypto from "node:crypto";
import { tokenStore, garageStore, linkStore } from "../storage/stores.js";

function nowIso() {
  return new Date().toISOString();
}

function sanitizeSpecies(species) {
  return String(species ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function randomDigits(n = 5) {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10);
  return out;
}

export async function resolveSteam64ForDiscord(discordId) {
  const data = await linkStore.get();
  return data.links?.[discordId]?.steam64 ?? null;
}

export async function createSnapshotFromAdminInput({ ownerSteam64, species, values, createdByDiscordId }) {
  const snapshotId = crypto.randomUUID();
  const record = {
    id: snapshotId,
    ownerSteam64: ownerSteam64 || null,
    species,
    values,
    createdByDiscordId,
    createdAt: nowIso(),
    deletedAt: null,
    source: "ADMIN",
  };

  await garageStore.update((data) => {
    data.snapshots[snapshotId] = record;
    return data;
  });

  return record;
}

export async function createSnapshotFromSafelog({ ownerSteam64, safelog, createdByDiscordId }) {
  const snapshotId = crypto.randomUUID();
  const record = {
    id: snapshotId,
    ownerSteam64: ownerSteam64 || null,
    species: safelog?.species ?? "Unknown",
    values: {
      gender: safelog?.gender ?? null,
      growth: Number(safelog?.growth ?? NaN),
      playerName: safelog?.playerName ?? null,
      loggedAt: safelog?.at ?? null,
    },
    createdByDiscordId,
    createdAt: nowIso(),
    deletedAt: null,
    source: "SAFELOG",
  };

  await garageStore.update((data) => {
    data.snapshots[snapshotId] = record;
    return data;
  });

  return record;
}

export async function createTokenForSnapshot({ species, snapshotId, issuedToSteam64, issuedByDiscordId }) {
  const s = sanitizeSpecies(species);
  if (!s) throw new Error("Species is required.");

  // Token code is the redeem string (what players type).
  // Example: Tyrannasaurus45775
  const data = await tokenStore.get();
  const existing = data.tokens ?? {};

  let code;
  for (let i = 0; i < 50; i++) {
    const candidate = `${s}${randomDigits(5)}`;
    if (!existing[candidate]) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new Error("Failed to generate a unique token code. Try again.");

  const tokenRecord = {
    token: code,
    displayName: code,
    species: s,
    snapshotId,
    issuedToSteam64: issuedToSteam64 || null,
    issuedByDiscordId,
    createdAt: nowIso(),
    redeemedAt: null,
    redeemedByDiscordId: null,
    revokedAt: null,
    revokedByDiscordId: null,
    notes: null,
    usesRemaining: 1,
  };

  await tokenStore.update((d) => {
    d.tokens[code] = tokenRecord;
    return d;
  });

  return tokenRecord;
}

export async function listTokensForSteam64(steam64) {
  const data = await tokenStore.get();
  const tokens = Object.values(data.tokens ?? {});
  return tokens
    .filter((t) => !t.revokedAt && !t.redeemedAt)
    .filter((t) => !t.issuedToSteam64 || t.issuedToSteam64 === steam64)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getToken(tokenCode) {
  const data = await tokenStore.get();
  return data.tokens?.[tokenCode] ?? null;
}


async function getSnapshotById(id) {
  const sid = String(id ?? "").trim();
  if (!sid) return null;
  const g = await garageStore.getAll();
  return g.snapshots?.[sid] ?? null;
}


export async function redeemToken({ tokenCode, redeemerDiscordId, redeemerSteam64 }) {
  const code = String(tokenCode ?? "").trim();
  if (!code) throw new Error("Token is required.");

  const token = await getToken(code);
  if (!token) throw new Error("Token not found.");
  if (token.revokedAt) throw new Error("Token has been revoked.");
  if (token.redeemedAt) throw new Error("Token has already been redeemed.");
  if (token.issuedToSteam64 && token.issuedToSteam64 !== redeemerSteam64) {
    throw new Error("This token is assigned to a different Steam64.");
  }

  // Mark token redeemed and (soft) delete snapshot in one go.
  await tokenStore.update((d) => {
    const t = d.tokens?.[code];
    if (!t) return d;
    if (t.revokedAt || t.redeemedAt) return d;
    t.redeemedAt = nowIso();
    t.redeemedByDiscordId = redeemerDiscordId;
    t.usesRemaining = 0;
    d.tokens[code] = t;
    return d;
  });

  if (token.snapshotId) {
    await garageStore.update((g) => {
      const s = g.snapshots?.[token.snapshotId];
      if (s && !s.deletedAt) s.deletedAt = nowIso();
      return g;
    });
  }

  return await getToken(code);
}

export async function revokeToken({ tokenCode, revokedByDiscordId }) {
  const code = String(tokenCode ?? "").trim();
  if (!code) throw new Error("Token is required.");

  const token = await getToken(code);
  if (!token) throw new Error("Token not found.");
  if (token.revokedAt) throw new Error("Token is already revoked.");
  if (token.redeemedAt) throw new Error("Token was already redeemed; cannot revoke.");

  await tokenStore.update((d) => {
    const t = d.tokens?.[code];
    if (!t) return d;
    t.revokedAt = nowIso();
    t.revokedByDiscordId = revokedByDiscordId;
    d.tokens[code] = t;
    return d;
  });

  return await getToken(code);
}

export async function purgeInactiveTokens({ purgedByDiscordId } = {}) {
  // "Inactive" = revoked or redeemed. We hard-delete these token records and any linked snapshots.
  const tdata = await tokenStore.get();
  const tokens = tdata.tokens ?? {};

  const inactiveCodes = [];
  const snapshotIds = new Set();

  for (const [code, t] of Object.entries(tokens)) {
    if (!t) continue;
    if (t.revokedAt || t.redeemedAt) {
      inactiveCodes.push(code);
      if (t.snapshotId) snapshotIds.add(t.snapshotId);
    }
  }

  await tokenStore.update((d) => {
    d.tokens = d.tokens ?? {};
    for (const code of inactiveCodes) delete d.tokens[code];
    // Light audit trail (optional) - keeps a timestamp only, no big logs
    d.lastPurgeAt = nowIso();
    d.lastPurgedByDiscordId = purgedByDiscordId ?? null;
    return d;
  });

  // Remove linked snapshots and any snapshots already marked deleted.
  let deletedSnapshots = 0;
  await garageStore.update((g) => {
    g.snapshots = g.snapshots ?? {};
    for (const [id, s] of Object.entries(g.snapshots)) {
      if (!s) continue;
      if (snapshotIds.has(id) || s.deletedAt) {
        delete g.snapshots[id];
        deletedSnapshots++;
      }
    }
    g.lastPurgeAt = nowIso();
    g.lastPurgedByDiscordId = purgedByDiscordId ?? null;
    return g;
  });

  return {
    deletedTokens: inactiveCodes.length,
    deletedSnapshots,
  };
}


export async function getSnapshot(snapshotId) {
  return await getSnapshotById(snapshotId);
}
