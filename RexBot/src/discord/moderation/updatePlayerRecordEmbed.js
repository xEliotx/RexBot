import { EmbedBuilder } from "discord.js";

function summarizeCounts(record) {
    const warnings = record.history.filter((x) => x.type === "warn").length;
    const bans = record.history.filter((x) => x.type === "ban").length;
    const notes = record.history.filter((x) => x.type === "note").length;

    return { warnings, bans, notes };
}

function getStatusInfo(counts) {
    let status = "CLEAN";
    let emoji = "✅";
    let color = 0x2b2d31;

    if (counts.bans > 0) {
        status = "BANNED HISTORY";
        emoji = "⛔";
        color = 0x8b0000;
    } else if (counts.warnings >= 2) {
        status = "REPEAT OFFENDER";
        emoji = "⚠⚠";
        color = 0xff8c00;
    } else if (counts.warnings === 1) {
        status = "WARNED";
        emoji = "⚠";
        color = 0xffcc00;
    }

    return { status, emoji, color };
}

function formatHistoryEntry(entry) {
    const ts = Math.floor(new Date(entry.date).getTime() / 1000);
    return `• **${entry.type.toUpperCase()}** — ${entry.reason}\n  <t:${ts}:f> by <@${entry.staffId}>`;
}

export async function updatePlayerRecordEmbed(guild, user, record, channelId) {
    if (!channelId) return;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const counts = summarizeCounts(record);
    const statusInfo = getStatusInfo(counts);
    const recentHistory = [...record.history].slice(-10).reverse();

    const embed = new EmbedBuilder()
        .setColor(statusInfo.color)
        .setTitle(`Player Record: ${user.tag} [${statusInfo.status}] ${statusInfo.emoji}`)
        .setDescription(`Discord ID: \`${user.id}\``)
        .addFields(
            { name: "Warnings", value: String(counts.warnings), inline: true },
            { name: "Bans", value: String(counts.bans), inline: true },
            { name: "Notes", value: String(counts.notes), inline: true },
            {
                name: "Recent History",
                value: recentHistory.length
                    ? recentHistory.map(formatHistoryEntry).join("\n\n").slice(0, 1024)
                    : "No history recorded.",
            }
        )
        .setFooter({ text: "Staff moderation record" })
        .setTimestamp();

    let message = null;

    if (record.recordMessageId) {
        message = await channel.messages.fetch(record.recordMessageId).catch(() => null);
    }

    if (message) {
        await message.edit({ embeds: [embed] });
    } else {
        const sent = await channel.send({ embeds: [embed] });
        record.recordMessageId = sent.id;
    }
}