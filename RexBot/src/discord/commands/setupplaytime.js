import {
    SlashCommandBuilder,
    ChannelType,
    PermissionsBitField,
} from "discord.js";

export const setupplaytime = {
    data: new SlashCommandBuilder()
        .setName("setupplaytime")
        .setDescription("Create and setup the playtime leaderboard channel"),

    async execute(interaction, { client, playtimeTracker }) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply({
                content: "❌ You need admin to run this.",
            });
        }


        try {
            const guild = interaction.guild;

            // 1. Try find existing channel
            let channel = guild.channels.cache.find(
                (c) => c.name === "playtime-leaderboard"
            );

            // 2. Create if not exists
            if (!channel) {
                channel = await guild.channels.create({
                    name: "playtime-leaderboard",
                    type: ChannelType.GuildText,
                });
            }

            // 3. Lock channel
            await channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: false,
                AddReactions: false,
                CreatePublicThreads: false,
                CreatePrivateThreads: false,
            });

            // 4. Update tracker channel
            playtimeTracker.channelId = channel.id;
            playtimeTracker.store.setChannel(channel.id);

            // 5. Force embed creation/update
            await playtimeTracker.updateEmbed();

            await interaction.editReply({
                content: `✅ Playtime leaderboard setup complete in ${channel}`,
            });
        } catch (err) {
            console.error("setupplaytime error:", err);

            await interaction.editReply({
                content: `❌ Failed: ${err.message}`,
            });
        }
    },
};