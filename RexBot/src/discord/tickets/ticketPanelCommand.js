import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "discord.js";

export function buildTicketPanelMessage(guild) {
    const embed = new EmbedBuilder()
        .setColor(0xff0033)
        .setAuthor({
            name: guild?.name ?? "Ticket System",
            iconURL: guild?.iconURL?.() ?? undefined,
        })
        .setTitle("🎫 Support Tickets")
        .setImage("https://cdn.discordapp.com/attachments/778652435227869214/1486468541002809565/Tickets.png?ex=69c59d35&is=69c44bb5&hm=742a1e032f0f9ba772a09086ef39c62c0d3a347cb447d7bc443cd7ebdc7ee909&")
        .setDescription(
            [
                "**Need help?** Open a ticket and staff will respond.",
                "",
                "📌 Please include:",
                "> • What happened.",
                "> • When it happened.",
                "> • Screenshots/clips if possible.",
                "> • General details to help us assist you faster.",
            ].join("\n")
        );

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket:create")
            .setPlaceholder("📩 Select a ticket type…")
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("Ingame Support")
                    .setValue("ingame_support")
                    .setDescription("Issues while playing on the server")
                    .setEmoji("🆘"),

                new StringSelectMenuOptionBuilder()
                    .setLabel("Report a Player")
                    .setValue("report_player")
                    .setDescription("Report rule-breaking behavior")
                    .setEmoji("😡"),

                new StringSelectMenuOptionBuilder()
                    .setLabel("Discord Support")
                    .setValue("discord_support")
                    .setDescription("Issues with Discord, roles, or access")
                    .setEmoji("⌨️"),

                new StringSelectMenuOptionBuilder()
                    .setLabel("Admin Report")
                    .setValue("admin_report")
                    .setDescription("Sensitive issues (owners only)")
                    .setEmoji("🛑"),

                new StringSelectMenuOptionBuilder()
                    .setLabel("Other")
                    .setValue("other")
                    .setDescription("Anything else")
                    .setEmoji("❓"),
            )
    );

    return {
        embeds: [embed],
        components: [row],
    };
}

export const ticketPanel = {
    data: new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Create or update the ticket panel (admin only).")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    scope: "ADMIN",

    async execute(interaction, ctx) {
        const channelId = ctx.config.channels.ticketPanelChannelId;
        if (!channelId) {
            await interaction.reply({
                content: "❌ TICKET_PANEL_CHANNEL_ID is not set.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const panelChannel = await interaction.client.channels.fetch(channelId).catch(() => null);

        if (!panelChannel || !panelChannel.isTextBased()) {
            await interaction.reply({
                content: "❌ Ticket panel channel not found or not text-based.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const everyoneId = interaction.guild.id;
        await panelChannel.permissionOverwrites.edit(everyoneId, {
            SendMessages: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
        });

        const payload = buildTicketPanelMessage(interaction.guild);
        const existingMessageId = ctx.config.channels.ticketPanelMessageId;

        if (existingMessageId) {
            const existingMessage = await panelChannel.messages.fetch(existingMessageId).catch(() => null);

            if (existingMessage) {
                await existingMessage.edit(payload);

                await interaction.reply({
                    content: "✅ Ticket panel updated.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        const newMessage = await panelChannel.send(payload);

        await interaction.reply({
            content:
                `✅ Ticket panel created.\n\n` +
                `Add this to your .env:\n` +
                `\`\`\`\nTICKET_PANEL_MESSAGE_ID=${newMessage.id}\n\`\`\``,
            flags: MessageFlags.Ephemeral,
        });
    },
};