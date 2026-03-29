import { EmbedBuilder } from "discord.js";
import { parseTicketTopic } from "./ticketMeta.js";
import { buildTicketTranscriptFiles } from "./ticketTranscript.js";

export async function notifyTicketOwnerClosed(channel, details = {}, ctx = {}) {
    if (!ctx.config?.channels?.ticketCloseDmEnabled) return false;

    const { ownerId, ticketNum, ticketType } = parseTicketTopic(channel.topic ?? "");
    if (!ownerId) return false;

    if (ticketType === "admin_report") return false;

    const user = await channel.client.users.fetch(ownerId).catch(() => null);
    if (!user) return false;

    const files = await buildTicketTranscriptFiles(channel);

    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle("Your ticket was closed")
        .setDescription("Your transcript file is attached in the message below.")
        .addFields(
            { name: "🆔 Ticket ID", value: String(ticketNum ?? "Unknown"), inline: true },
            { name: "📂 Type", value: ticketType ?? "Unknown", inline: true },
            { name: "❌ Closed By", value: details.closedBy ?? "System", inline: true },
            { name: "⚙️ Closure Mode", value: details.closureMode ?? "Unknown", inline: true },
            { name: "📝 Reason", value: details.reason ?? "Resolved", inline: false },
        )
        .setFooter({
            text: channel.guild?.name ?? "Ticket System",
        })
        .setTimestamp();

    await user.send({
        embeds: [embed],
    });

    await user.send({
        content: "Here is your ticket transcript file.",
        files: [files.txt],
    });

    return true;
}