import { parsePlayerList } from "./parsePlayerList.js";
import {
    buildPlaytimeComponents,
    buildPlaytimeEmbed,
} from "../discord/ui/playtimeEmbed.js";

export class PlaytimeTracker {
    constructor({ client, rcon, store, channelId }) {
        this.client = client;
        this.rcon = rcon;
        this.store = store;
        this.channelId = channelId;

        this.trackIntervalMs = 60_000;
        this.embedIntervalMs = 600_000; // change back to 3_600_000 later if you want

        this.trackTimer = null;
        this.embedTimer = null;

        this.maxMissedPolls = 2;
    }

    async fetchPlayers() {
        const raw = await this.rcon.sendCommand("playerlist");
        return parsePlayerList(raw);
    }

    async trackTick() {
        const data = this.store.getData();

        let players = [];
        try {
            players = await this.fetchPlayers();
        } catch (error) {
            console.error("[PlaytimeTracker] playerlist failed:", error);
            return;
        }

        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const currentPlayers = new Map();

        if (players.length) {
            for (const player of players) {
                currentPlayers.set(player.playerId, player);

                if (!data.players[player.playerId]) {
                    data.players[player.playerId] = {
                        playerId: player.playerId,
                        displayName: player.name,
                        totalSeconds: 0,
                        firstSeen: nowIso,
                        lastSeen: nowIso,
                    };
                }

                const saved = data.players[player.playerId];
                saved.displayName = player.name;
                saved.lastSeen = nowIso;

                const session = data.sessions[player.playerId];

                if (!session) {
                    data.sessions[player.playerId] = {
                        playerId: player.playerId,
                        displayName: player.name,
                        joinedAt: nowIso,
                        lastSeen: nowIso,
                        missedPolls: 0,
                    };
                } else {
                    const diffSeconds = Math.max(
                        0,
                        Math.floor((now - new Date(session.lastSeen).getTime()) / 1000)
                    );

                    if (diffSeconds > 0) {
                        saved.totalSeconds += diffSeconds;
                    }

                    session.displayName = player.name;
                    session.lastSeen = nowIso;
                    session.missedPolls = 0;
                }
            }
        }

        for (const playerId of Object.keys(data.sessions)) {
            if (!currentPlayers.has(playerId)) {
                const session = data.sessions[playerId];
                session.missedPolls = (session.missedPolls || 0) + 1;

                if (session.missedPolls >= this.maxMissedPolls) {
                    delete data.sessions[playerId];
                }
            }
        }

        this.store.save();
    }

    async ensureEmbedMessage() {
        const data = this.store.getData();
        const channel = await this.client.channels.fetch(this.channelId);
        if (!channel) throw new Error(`Channel not found: ${this.channelId}`);

        let message = null;

        if (data.embedMessageId) {
            try {
                message = await channel.messages.fetch(data.embedMessageId);
            } catch {
                message = null;
            }
        }

        if (!message) {
            message = await channel.send({
                embeds: [buildPlaytimeEmbed(data)],
                components: buildPlaytimeComponents(),
            });

            this.store.setEmbedMessage(channel.id, message.id);
        }

        return message;
    }

    async updateEmbed() {
        const data = this.store.getData();
        const message = await this.ensureEmbedMessage();
        await message.edit({
            embeds: [buildPlaytimeEmbed(data)],
            components: buildPlaytimeComponents(),
        });
    }

    async start() {
        await this.trackTick();
        await this.updateEmbed();

        this.trackTimer = setInterval(() => {
            this.trackTick().catch((err) => {
            });
        }, this.trackIntervalMs);

        this.embedTimer = setInterval(() => {
            this.updateEmbed().catch((err) => {
            });
        }, this.embedIntervalMs);
    }

    async resetLeaderboard() {
        this.store.resetLeaderboard();
        await this.updateEmbed();
    }
}