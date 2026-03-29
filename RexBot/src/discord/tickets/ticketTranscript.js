import { AttachmentBuilder, ChannelType, EmbedBuilder } from "discord.js";
import { parseTicketTopic } from "./ticketMeta.js";

function escapeText(text = "") {
    return String(text).replace(/\r/g, "");
}

function attachmentSummary(message) {
    if (!message.attachments?.size) return [];
    return [...message.attachments.values()].map((a) => ({
        name: a.name ?? "file",
        url: a.url,
        contentType: a.contentType ?? "unknown",
    }));
}

function embedSummary(embed) {
    const lines = [];
    if (embed.title) lines.push(`Title: ${embed.title}`);
    if (embed.description) lines.push(`Description: ${embed.description}`);
    if (embed.url) lines.push(`URL: ${embed.url}`);
    if (embed.fields?.length) {
        for (const field of embed.fields) {
            lines.push(`Field - ${field.name}: ${field.value}`);
        }
    }
    return lines;
}

async function fetchAllMessages(channel) {
    const all = [];
    let before;

    while (true) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? { before } : {}),
        });

        if (!batch.size) break;

        all.push(...batch.values());
        before = batch.last().id;

        if (batch.size < 100) break;
    }

    return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

export async function buildTicketTranscriptFiles(channel) {
    const messages = await fetchAllMessages(channel);
    const meta = parseTicketTopic(channel.topic ?? "");

    const txtLines = [
        "Ticket Transcript",
        `Guild: ${channel.guild?.name ?? "Unknown"}`,
        `Channel: #${channel.name}`,
        `Channel ID: ${channel.id}`,
        `Owner ID: ${meta.ownerId ?? "Unknown"}`,
        `Ticket Number: ${meta.ticketNum ?? "Unknown"}`,
        `Ticket Type: ${meta.ticketType ?? "Unknown"}`,
        `Generated At: ${new Date().toISOString()}`,
        "",
        "============================================================",
        "",
    ];

    for (const message of messages) {
        const timestamp = new Date(message.createdTimestamp).toISOString();
        const authorTag = message.author?.tag ?? "Unknown User";
        const authorId = message.author?.id ?? "unknown";
        const content = escapeText(message.content || "");
        const attachments = attachmentSummary(message);

        txtLines.push(`[${timestamp}] ${authorTag} (${authorId}): ${content}`);

        for (const item of attachments) {
            txtLines.push(`  [Attachment] ${item.name} -> ${item.url}`);
        }

        for (const embed of message.embeds ?? []) {
            for (const line of embedSummary(embed)) {
                txtLines.push(`  [Embed] ${line}`);
            }
        }

        if (message.components?.length) {
            txtLines.push("  [Components attached]");
        }

        txtLines.push("");
    }

    return {
        txt: new AttachmentBuilder(Buffer.from(txtLines.join("\n"), "utf8"), {
            name: `${channel.name}-transcript.txt`,
        }),
    };
}

async function resolveLogChannel(channel, config) {
    const meta = parseTicketTopic(channel.topic ?? "");

    const logChannelId =
        meta.ticketType === "admin_report"
            ? config.channels.adminReportLogsChannelId
            : config.channels.ticketLogsChannelId;

    if (!logChannelId) return null;

    const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel || logChannel.type !== ChannelType.GuildText) return null;

    return logChannel;
}

export async function sendTicketTranscript(channel, ctx, details = {}) {
    const logChannel = await resolveLogChannel(channel, ctx.config);
    if (!logChannel) return;

    const meta = parseTicketTopic(channel.topic ?? "");
    const files = await buildTicketTranscriptFiles(channel);

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
            name: channel.guild?.name ?? "Ticket System",
            iconURL: channel.guild?.iconURL?.() ?? undefined,
        })
        .setTitle("Ticket Closed")
        .addFields(
            { name: "🆔 Ticket ID", value: String(meta.ticketNum ?? "Unknown"), inline: true },
            { name: "✅ Opened By", value: meta.ownerId ? `<@${meta.ownerId}>` : "Unknown", inline: true },
            { name: "❌ Closed By", value: details.closedBy ?? "System", inline: true },
            { name: "📂 Ticket Type", value: meta.ticketType ?? "Unknown", inline: true },
            { name: "⚙️ Closure Mode", value: details.closureMode ?? "Unknown", inline: true },
            { name: "💬 Channel", value: `#${channel.name}`, inline: true },
            { name: "📝 Reason", value: details.reason ?? "Resolved", inline: false },
            { name: "👤 Claimed By", value: details.claimedBy ?? "Not claimed", inline: true },
        )
        .setFooter({
            text: `Channel ID: ${channel.id}`,
        })
        .setTimestamp();

    await logChannel.send({
        embeds: [embed],
    });

    await logChannel.send({
        files: [files.txt],
    });
}