import { AttachmentBuilder, ChannelType, EmbedBuilder } from "discord.js";
import { parseTicketTopic } from "./ticketMeta.js";

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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

    const htmlParts = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
        `  <title>${escapeHtml(channel.name)} transcript</title>`,
        "  <style>",
        "    body { font-family: Arial, sans-serif; background:#111827; color:#e5e7eb; margin:0; padding:24px; }",
        "    .wrap { max-width: 1100px; margin: 0 auto; }",
        "    .card { background:#1f2937; border:1px solid #374151; border-radius:12px; padding:16px; margin-bottom:14px; }",
        "    .meta { color:#9ca3af; font-size:12px; margin-bottom:6px; }",
        "    .author { font-weight:700; color:#fff; }",
        "    .content { white-space:pre-wrap; margin-top:8px; }",
        "    .attachments, .embeds { margin-top:10px; font-size:14px; }",
        "    a { color:#93c5fd; }",
        "    h1 { margin-top:0; }",
        "  </style>",
        "</head>",
        "<body>",
        '  <div class="wrap">',
        "    <h1>Ticket Transcript</h1>",
        `    <div class="card">
           <div><strong>Guild:</strong> ${escapeHtml(channel.guild?.name ?? "Unknown")}</div>
           <div><strong>Channel:</strong> #${escapeHtml(channel.name)}</div>
           <div><strong>Owner ID:</strong> ${escapeHtml(meta.ownerId ?? "Unknown")}</div>
           <div><strong>Ticket Number:</strong> ${escapeHtml(meta.ticketNum ?? "Unknown")}</div>
           <div><strong>Ticket Type:</strong> ${escapeHtml(meta.ticketType ?? "Unknown")}</div>
           <div><strong>Generated:</strong> ${escapeHtml(new Date().toISOString())}</div>
         </div>`,
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

        htmlParts.push('    <div class="card">');
        htmlParts.push(`      <div class="meta">${escapeHtml(timestamp)}</div>`);
        htmlParts.push(`      <div class="author">${escapeHtml(authorTag)} <span class="meta">(${escapeHtml(authorId)})</span></div>`);
        htmlParts.push(`      <div class="content">${escapeHtml(content || "[no text content]")}</div>`);

        if (attachments.length) {
            htmlParts.push('      <div class="attachments"><strong>Attachments</strong><ul>');
            for (const item of attachments) {
                htmlParts.push(`        <li><a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a> <span class="meta">(${escapeHtml(item.contentType)})</span></li>`);
            }
            htmlParts.push("      </ul></div>");
        }

        if (message.embeds?.length) {
            htmlParts.push('      <div class="embeds"><strong>Embeds</strong><ul>');
            for (const embed of message.embeds) {
                for (const line of embedSummary(embed)) {
                    htmlParts.push(`        <li>${escapeHtml(line)}</li>`);
                }
            }
            htmlParts.push("      </ul></div>");
        }

        htmlParts.push("    </div>");
    }

    htmlParts.push("  </div>", "</body>", "</html>");

    return {
        txt: new AttachmentBuilder(Buffer.from(txtLines.join("\n"), "utf8"), {
            name: `${channel.name}-transcript.txt`,
        }),
        html: new AttachmentBuilder(Buffer.from(htmlParts.join("\n"), "utf8"), {
            name: `${channel.name}-transcript.html`,
        }),
    };
}

async function resolveLogChannel(channel, config) {
    const logChannelId = config.channels.ticketLogsChannelId;
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
            { name: "Ticket ID", value: meta.ticketNum ?? "Unknown", inline: true },
            { name: "Opened By", value: meta.ownerId ? `<@${meta.ownerId}>` : "Unknown", inline: true },
            { name: "Closed By", value: details.closedBy ?? "System", inline: true },
            { name: "Open Time", value: `<#${channel.id}>`, inline: true },
            { name: "Claimed By", value: details.claimedBy ?? "Not claimed", inline: true },
            { name: "Reason", value: details.reason ?? "Resolved", inline: false },
        )
        .setTimestamp();

    await logChannel.send({
        embeds: [embed],
        files: [files.txt, files.html],
    });
}