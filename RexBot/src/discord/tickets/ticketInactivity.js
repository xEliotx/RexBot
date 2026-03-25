import {
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import { sendTicketTranscript } from "./ticketTranscript.js";
import { notifyTicketOwnerClosed } from "./ticketNotifications.js";

function parseTopic(topic = "") {
    const ownerId = topic.match(/ticket_owner=(\d+)/)?.[1] ?? null;
    const lastActivityMs = Number(topic.match(/last_activity=(\d+)/)?.[1] ?? 0);
    const warned = (topic.match(/warned=(\d+)/)?.[1] ?? "0") === "1";
    return { ownerId, lastActivityMs, warned };
}

function setTopicValue(topic, key, value) {
    if (topic.includes(`${key}=`)) {
        return topic.replace(new RegExp(`${key}=\\d+`), `${key}=${value}`);
    }
    return `${topic};${key}=${value}`;
}

export function startTicketInactivityWatcher({ client, config, logger }) {
    const guildId = config.discord.guildId;
    const categoryId = config.channels.ticketCategoryId;

    const inactivityMs = (config.channels.ticketInactivityHours ?? 48) * 60 * 60 * 1000;
    const warnBeforeMs = (config.channels.ticketWarnBeforeHours ?? 1) * 60 * 60 * 1000;
    const intervalMs = (config.channels.ticketInactivityCheckMinutes ?? 10) * 60 * 1000;

    setInterval(async () => {
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return;

            const now = Date.now();

            const ticketChannels = guild.channels.cache.filter(
                (c) => c.type === ChannelType.GuildText && c.parentId === categoryId
            );

            for (const [, ch] of ticketChannels) {
                const topic = ch.topic ?? "";
                const { ownerId, lastActivityMs, warned } = parseTopic(topic);
                if (!ownerId) continue;

                // if last_activity missing, initialize once
                if (!lastActivityMs) {
                    const initTopic = setTopicValue(setTopicValue(topic, "last_activity", now), "warned", 0);
                    await ch.setTopic(initTopic);
                    continue;
                }

                const idleMs = now - lastActivityMs;

                // warn window
                if (!warned && idleMs >= (inactivityMs - warnBeforeMs)) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket:keepopen")
                            .setLabel("Keep Open")
                            .setStyle(ButtonStyle.Success)
                    );

                    await ch.send({
                        content: `⏳ This ticket will auto-close in **${Math.max(1, Math.round((inactivityMs - idleMs) / 60000))} min** due to inactivity.\nClick **Keep Open** if you still need help.`,
                        components: [row],
                    }).catch(() => { });

                    const warnedTopic = setTopicValue(topic, "warned", 1);
                    await ch.setTopic(warnedTopic).catch(() => { });
                    continue;
                }

                // close
                if (idleMs >= inactivityMs) {
                    await ch.send("🧹 Auto-closing ticket due to inactivity.").catch(() => { });

                    const details = {
                        closureMode: "Automatic",
                        reason: "Ticket auto-closed due to inactivity",
                        closedBy: "System",
                        claimedBy: "Not claimed",
                    };

                    try {
                        await sendTicketTranscript(ch, { config, logger }, details);
                    } catch (err) {
                        logger?.warn?.("Failed to save auto-close transcript:", err);
                    }

                    try {
                        await notifyTicketOwnerClosed(ch, details, { config, logger });
                    } catch (err) {
                        logger?.warn?.("Failed to DM ticket owner after auto-close:", err);
                    }

                    await ch.delete("Ticket auto-closed due to inactivity").catch(() => { });
                }
            }
        } catch (err) {
            logger?.warn?.("Ticket inactivity watcher error:", err);
        }
    }, intervalMs);
}
