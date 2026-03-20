import fs from "node:fs";
import path from "node:path";

export class PlaytimeStore {
    constructor(filePath = path.join(process.cwd(), "data", "playtime.json")) {
        this.filePath = filePath;
        this.data = {
            players: {},
            sessions: {},
            embedChannelId: null,
            embedMessageId: null,
            lastResetAt: null,
        };

        this.ensureDir();
        this.load();
    }

    ensureDir() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                this.save();
                return;
            }

            const raw = fs.readFileSync(this.filePath, "utf8");
            const parsed = raw.trim() ? JSON.parse(raw) : {};

            this.data = {
                players: parsed.players || {},
                sessions: {},
                embedChannelId: parsed.embedChannelId || null,
                embedMessageId: parsed.embedMessageId || null,
                lastResetAt: parsed.lastResetAt || null,
            };

            console.log("[PlaytimeStore] load players:", Object.keys(this.data.players));
        } catch (error) {
            console.error("[PlaytimeStore] load failed:", error);
        }
    }

    save() {
        try {
            console.log("[PlaytimeStore] save players:", Object.keys(this.data.players));
            console.log("[PlaytimeStore] save sessions:", Object.keys(this.data.sessions));

            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
        } catch (error) {
            console.error("[PlaytimeStore] save failed:", error);
        }
    }

    getData() {
        return this.data;
    }

    setChannel(channelId) {
        this.data.embedChannelId = channelId;
        this.save();
    }

    setEmbedMessage(channelId, messageId) {
        this.data.embedChannelId = channelId;
        this.data.embedMessageId = messageId;
        this.save();
    }

    resetLeaderboard() {
        console.warn("[PlaytimeStore] resetLeaderboard CALLED");
        console.trace("[PlaytimeStore] resetLeaderboard trace");

        this.data.players = {};
        this.data.sessions = {};
        this.data.lastResetAt = new Date().toISOString();
        this.save();
    }
}