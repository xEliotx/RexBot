import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "discord.js";

const TICKET_PANEL_CHANNEL_ID = "1467572329444938024";

export const ticketPanel = {
    data: new SlashCommandBuilder()
        .setName("ticketpanel")
        .setDescription("Post the ticket panel in the Create-a-Ticket channel (admin only).")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // Option A: only usable in admin channel (your guard checks this)
    scope: "ADMIN",

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0xff0033)
            .setTitle("🎫 Support Tickets")
            .setDescription(
                [
                    "**Need help?** Open a ticket and staff will respond.",
                    "",
                    "📌 Please include:",
                    "• What happened",
                    "• When it happened",
                    "• Screenshots/clips if possible",
                    "• General details to help us assist you faster",
                ].join("\n")
            );

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("ticket:create")
                .setPlaceholder("📩Select a ticket type…")
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
                        .setDescription("Sensitive issues (admins only)")
                        .setEmoji("🛑"),

                    new StringSelectMenuOptionBuilder()
                        .setLabel("Other")
                        .setValue("other")
                        .setDescription("Anything else")
                        .setEmoji("❓"),
                )
        );


        const panelChannel = await interaction.client.channels
            .fetch(TICKET_PANEL_CHANNEL_ID)
            .catch(() => null);

        if (!panelChannel || !panelChannel.isTextBased()) {
            await interaction.reply({
                content: "❌ Ticket panel channel not found or not text-based.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // 🔒 Make the panel channel button-only
        const everyoneId = interaction.guild.id;
        await panelChannel.permissionOverwrites.edit(everyoneId, {
            SendMessages: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
        });

        // Send the panel message
        await panelChannel.send({
            embeds: [embed],
            components: [row],
        });

        // Confirm privately to the admin
        await interaction.reply({
            content: `✅ Ticket panel posted in <#${TICKET_PANEL_CHANNEL_ID}>`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
