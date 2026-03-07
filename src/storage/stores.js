// src/storage/stores.js
import path from "node:path";
import { JsonStore } from "./jsonStore.js";

const dataDir = path.resolve(process.cwd(), "data");

export const linkStore = new JsonStore(path.join(dataDir, "links.json"), {
  version: 1,
  links: {},
});


export const tokenStore = new JsonStore(path.join(dataDir, "tokens.json"), {
  version: 1,
  tokens: {},
});

export const garageStore = new JsonStore(path.join(dataDir, "garage.json"), {
  version: 1,
  snapshots: {},
  slots: {}, // key: steam64, value: { "1": snapshotId, "2": snapshotId, ... }
});
