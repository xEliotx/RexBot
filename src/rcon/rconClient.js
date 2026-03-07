// src/rcon/rconClient.js
// Evrima RCON client (byte-framed protocol, NOT Source RCON)
//
// Protocol (community reverse engineered):
// - Auth: 0x01 + password (utf8)  [no terminator required]
// - Exec: 0x02 + commandByte + argsCSV(utf8)  [no terminator required]
// - One response per request, plain text (timestamp/type sometimes present)
// Ref: github.com/butt4cak3/theislercon :contentReference[oaicite:1]{index=1}

import net from "node:net";

// These are configurable to better handle WAN jitter and chunked responses.
// Pterodactyl-hosted bots talking to a remote Evrima server (e.g., GPORTAL)
// often need a larger quiet window than LAN.
const DEFAULT_TIMEOUT_MS = Number(process.env.RCON_TIMEOUT_MS ?? 8000);
const QUIET_WINDOW_MS = Number(process.env.RCON_QUIET_WINDOW_MS ?? 150);

const COMMAND_BYTES = {
  announce: 0x10,
  dm: 0x11,
  "srv:details": 0x12,
  "entities:wipe:corpses": 0x13,
  updateplayables: 0x15,

  ban: 0x20,
  kick: 0x30,
  players: 0x40,
  playerlist: 0x40,
  save: 0x50,

  playerdata: 0x77,

  "whitelist:toggle": 0x81,
  "whitelist:add": 0x82,
  "whitelist:remove": 0x83,

  "globalchat:toggle": 0x84,
  "humans:toggle": 0x86,

  "ai:toggle": 0x90,
  "ai:classes:disable": 0x91,
  "ai:density": 0x92,
};

function bufferToText(buf) {
  // Don’t strip anything aggressively; just trim whitespace
  return Buffer.from(buf).toString("utf8").trim();
}

export class EvrimaRconClient {
  constructor({ host, port, password, logger } = {}) {
    this.host = host;
    this.port = Number(port);
    this.password = password ?? "";
    this.logger = logger;

    this.socket = null;
    this.connected = false;
    this.connecting = false;

    this._pending = []; // FIFO pending request resolvers
    this._rxBuffer = Buffer.alloc(0);
    this._collectTimer = null;
    this._closedSinceLastRequest = false;

    // Serialize requests to prevent response coalescing from breaking FIFO.
    // Evrima's RCON responses are plain text with no request id; if two commands
    // overlap, two responses can arrive back-to-back and get merged into one
    // buffer, resolving only the first pending promise.
    this._queue = Promise.resolve();
  }

  async connect(timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (this.connected) return;
    if (this.connecting) throw new Error("RCON connect already in progress");
    if (!this.host || !this.port) throw new Error("RCON host/port not set");

    this.connecting = true;
    this._closedSinceLastRequest = false;

    try {
      const socket = new net.Socket();
      this.socket = socket;

      socket.on("data", (chunk) => this._onData(chunk));
      socket.on("error", (err) => this._onError(err));
      socket.on("close", () => this._onClose());

      // Help keep long-lived WAN connections alive.
      socket.setKeepAlive(true, 30_000);

      await new Promise((resolve, reject) => {
        const onErr = (e) => {
          socket.off("connect", onConnect);
          reject(e);
        };
        const onConnect = () => {
          socket.off("error", onErr);
          resolve();
        };

        socket.once("error", onErr);
        socket.once("connect", onConnect);
        socket.connect(this.port, this.host);
      });

      this.logger?.info?.(
        `RCON TCP connected to ${this.host}:${this.port}. Sending AUTH...`
      );

      // AUTH: 0x01 + password (NO null terminator)
      const authFrame = Buffer.concat([Buffer.from([0x01]), Buffer.from(this.password, "utf8")]);

      const authResp = await this._request(authFrame, timeoutMs);
      const authText = authResp.text;

      if (!/password accepted/i.test(authText)) {
        this.disconnect();
        throw new Error(`RCON auth failed: ${authText || "No response"}`);
      }

      this.connected = true;
      this.logger?.info?.("RCON authenticated.");
    } finally {
      // Never leave the instance stuck in a "connecting" state.
      this.connecting = false;
    }
  }

  disconnect() {
    this.connected = false;
    this.connecting = false;

    // reject all pending requests
    while (this._pending.length) {
      const p = this._pending.shift();
      p?.reject?.(new Error("RCON disconnected"));
    }

    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {}
      this.socket = null;
    }

    this._rxBuffer = Buffer.alloc(0);
    if (this._collectTimer) {
      clearTimeout(this._collectTimer);
      this._collectTimer = null;
    }
  }

  async sendCommand(name, ...params) {
    const cmdName = String(name || "").trim().toLowerCase();
    const cmdByte = COMMAND_BYTES[cmdName];
    if (cmdByte == null) {
      throw new Error(`Unknown Evrima RCON command "${name}"`);
    }

    // Args are CSV strings
    const csv = (params ?? [])
      .filter((x) => x !== undefined && x !== null)
      .map((x) => String(x))
      .join(",");

    // Exec frame: 0x02 + cmdByte + csv (NO null terminator)
    const frame =
      csv.length > 0
        ? Buffer.concat([Buffer.from([0x02, cmdByte]), Buffer.from(csv, "utf8")])
        : Buffer.from([0x02, cmdByte]);

    return (await this._sendWithReconnectRetry(frame)).text;
  }

  async sendRaw(rawLine) {
    const line = String(rawLine ?? "").trim();
    if (!line) throw new Error("Empty RCON command");

    const firstSpace = line.indexOf(" ");
    const cmd = (firstSpace === -1 ? line : line.slice(0, firstSpace)).trim().toLowerCase();
    const rest = firstSpace === -1 ? "" : line.slice(firstSpace + 1).trim();

    if (!rest) return await this.sendCommand(cmd);

    // Preserve commas/spaces by passing as a single arg string
    return await this.sendCommand(cmd, rest);
  }

  async _sendWithReconnectRetry(frame) {
    // Serialize all requests to avoid response coalescing breaking FIFO.
    this._queue = this._queue.then(() => this._sendWithReconnectRetryUnlocked(frame));
    return this._queue;
  }

  async _sendWithReconnectRetryUnlocked(frame) {
    // Ensure connected
    if (!this.connected) await this.connect();

    try {
      return await this._request(frame, DEFAULT_TIMEOUT_MS);
    } catch (err) {
      // Retry once with a fresh connection on common socket failures OR timeouts.
      const msg = String(err?.message ?? "");
      const shouldRetry =
        msg.includes("ECONNRESET") ||
        msg.includes("socket closed") ||
        msg.includes("RCON disconnected") ||
        msg.includes("RCON timeout waiting for response") ||
        this._closedSinceLastRequest;

      if (!shouldRetry) throw err;

      this.logger?.warn?.("RCON request failed, reconnecting and retrying once...");
      this.disconnect();
      await this.connect();
      return await this._request(frame, DEFAULT_TIMEOUT_MS);
    }
  }

  _onData(chunk) {
    // Buffer everything; responses are plain text and may arrive in multiple chunks
    this._rxBuffer = Buffer.concat([this._rxBuffer, chunk]);

    // Reset the quiet-window timer
    if (this._collectTimer) clearTimeout(this._collectTimer);

    const flush = () => {
      this._collectTimer = null;
      if (!this._pending.length) {
        this._rxBuffer = Buffer.alloc(0);
        return;
      }

      const buf = this._rxBuffer;
      this._rxBuffer = Buffer.alloc(0);

      const text = bufferToText(buf);

      const waiter = this._pending.shift();
      waiter?.resolve?.({ text, raw: buf });
    };

    // Quiet window: wait a bit so multi-line responses are captured
    this._collectTimer = setTimeout(flush, QUIET_WINDOW_MS);
  }

  _onError(err) {
    this.logger?.error?.("RCON socket error:", err);
    // let close handler do cleanup, but mark for retry logic
    this._closedSinceLastRequest = true;
  }

  _onClose() {
    this.logger?.warn?.("RCON socket closed.");
    this._closedSinceLastRequest = true;
    this.connected = false;
  }

  _request(frame, timeoutMs) {
    if (!this.socket) throw new Error("RCON socket not created");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // remove this pending entry if still present
        const idx = this._pending.findIndex((p) => p.reject === reject);
        if (idx >= 0) this._pending.splice(idx, 1);
        reject(new Error("RCON timeout waiting for response"));
      }, timeoutMs);

      this._pending.push({
        resolve: (val) => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      try {
        this.socket.write(frame);
      } catch (e) {
        clearTimeout(timeout);
        this._pending.pop();
        reject(e);
      }
    });
  }
}

export default EvrimaRconClient;
