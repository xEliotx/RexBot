import { EmbedBuilder } from "discord.js";
import { parseTicketTopic } from "./ticketMeta.js";

export function buildTicketStatusEmbed(channel) {
  const meta = parseTicketTopic(channel.topic ?? "");

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("Ticket Information")
    .addFields(
      { name: "Ticket ID", value: meta.ticketNum ?? "Unknown", inline: true },
      { name: "Opened By", value: meta.ownerId ? `<@${meta.ownerId}>` : "Unknown", inline: true },
      { name: "Type", value: meta.ticketType ?? "Unknown", inline: true },
      { name: "Claimed By", value: meta.claimedBy ? `<@${meta.claimedBy}>` : "Not claimed", inline: true },
    )
    .setFooter({
      text: `Channel: ${channel.name}`,
    })
    .setTimestamp();
}