import { EmbedBuilder } from "discord.js";
import { parseTicketTopic } from "./ticketMeta.js";
import { buildTicketTranscriptFiles } from "./ticketTranscript.js";

export async function notifyTicketOwnerClosed(channel, details = {}, ctx = {}) {
    if (!ctx.config?.channels?.ticketCloseDmEnabled) return false;

    const { ownerId, ticketNum, ticketType } = parseTicketTopic(channel.topic ?? "");
    if (!ownerId) return false;

    const user = await channel.client.users.fetch(ownerId).catch(() => null);
    if (!user) return false;

    const files = await buildTicketTranscriptFiles(channel);

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📁 Your Ticket Transcript")
        .setDescription("Your ticket has been closed. Your transcript file is attached.")
        .addFields(
            { name: "Ticket ID", value: `#${ticketNum ?? "Unknown"}`, inline: true },
            { name: "Type", value: ticketType ?? "Unknown", inline: true },
            { name: "Closed By", value: details.closedBy ?? "System", inline: true },
            { name: "Claimed By", value: details.claimedBy ?? "Not claimed", inline: true },
            { name: "Closure Mode", value: details.closureMode ?? "Unknown", inline: true },
            { name: "Reason", value: details.reason ?? "Resolved", inline: false },
        )
        .setFooter({
            text: channel.guild?.name ?? "Ticket System",
        })
        .setTimestamp();

    await user.send({
        embeds: [embed],
        files: [files.txt],
    });

    return true;
}