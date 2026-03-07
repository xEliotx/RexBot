// src/storage/jsonStore.js
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Tiny JSON store with atomic writes.
 * - Creates file if missing
 * - Reads/writes a single JSON object
 * - Writes via: write tmp -> rename
 */
export class JsonStore {
  constructor(filePath, defaultData = {}) {
    this.filePath = filePath;
    this.defaultData = defaultData;
    this._cache = null;
    this._loaded = false;
    // Serialize writes to avoid clobbering when multiple interactions save quickly.
    this._writeLock = Promise.resolve();
  }

  async _ensureDir() {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async load() {
    if (this._loaded && this._cache) return this._cache;

    await this._ensureDir();

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this._cache = JSON.parse(raw);
      this._loaded = true;
      return this._cache;
    } catch (err) {
      // If file missing or invalid, reset to default
      this._cache = structuredClone(this.defaultData);
      this._loaded = true;
      await this.save(this._cache);
      return this._cache;
    }
  }

  async save(data) {
    // queue writes to avoid race conditions
    this._writeLock = this._writeLock.then(async () => {
      await this._ensureDir();
      const tmp = `${this.filePath}.tmp`;

      const json = JSON.stringify(data, null, 2);
      await fs.writeFile(tmp, json, "utf8");
      await fs.rename(tmp, this.filePath);

      this._cache = data;
      this._loaded = true;
      return data;
    });
    return await this._writeLock;
  }

  async getAll() {
    return await this.load();
  }

  /**
   * Back-compat alias used across the codebase.
   * Returns the full JSON document.
   */
  async get() {
    return await this.getAll();
  }

  async setAll(next) {
    return await this.save(next);
  }

  /**
   * Back-compat helper used across the codebase.
   *
   * Loads the current document, lets you mutate (or return) the next document,
   * then atomically saves it.
   *
   * Usage:
   *   await store.update(d => { d.foo = 'bar'; return d; })
   *   await store.update(d => { d.foo = 'bar'; }) // also supported
   */
  async update(mutator) {
    const current = await this.load();
    // Avoid accidental mutation of the cached object before we commit.
    const draft = structuredClone(current);
    const maybeNext = await mutator(draft);
    const next = maybeNext === undefined ? draft : maybeNext;
    return await this.save(next);
  }

  // Get a key from a top-level map-like object (e.g. data.links[id])
  async getFromMap(mapKey, key) {
    const data = await this.load();
    const map = data?.[mapKey] ?? {};
    return map[key];
  }

  async setInMap(mapKey, key, value) {
    const data = await this.load();
    if (!data[mapKey] || typeof data[mapKey] !== "object") data[mapKey] = {};
    data[mapKey][key] = value;
    await this.save(data);
    return value;
  }

  async deleteFromMap(mapKey, key) {
    const data = await this.load();
    if (data?.[mapKey] && Object.prototype.hasOwnProperty.call(data[mapKey], key)) {
      delete data[mapKey][key];
      await this.save(data);
      return true;
    }
    return false;
  }
}
