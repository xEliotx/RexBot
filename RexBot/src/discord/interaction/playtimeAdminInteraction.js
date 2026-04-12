import { PermissionFlagsBits } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import {
    PLAYTIME_EXCLUDE_BUTTON_ID,
    PLAYTIME_RESET_BUTTON_ID,
    PLAYTIME_RESET_CONFIRM_BUTTON_ID,
    PLAYTIME_RESET_CANCEL_BUTTON_ID,
    PLAYTIME_EXCLUDE_SELECT_ID,
    PLAYTIME_REWARDS_BUTTON_ID,
    buildPlaytimeExcludeMenu,
    buildPlaytimeRewardsEmbed,
} from "../ui/playtimeEmbed.js";

function isAdmin(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

export async function handlePlaytimeAdminInteraction(interaction, { playtimeTracker }) {
    if (interaction.isButton()) {
        if (interaction.customId === PLAYTIME_REWARDS_BUTTON_ID) {
            await interaction.reply({
                embeds: [buildPlaytimeRewardsEmbed()],
                ...EPHEMERAL,
            });
            return true;
        }

        if (interaction.customId === PLAYTIME_EXCLUDE_BUTTON_ID) {
            if (!isAdmin(interaction)) {
                await interaction.reply({
                    content: "You do not have permission to manage the leaderboard.",
                    ...EPHEMERAL,
                });
                return true;
            }

            const data = playtimeTracker.store.getData();

            await interaction.reply({
                content: "Select players to exclude from the leaderboard.",
                components: buildPlaytimeExcludeMenu(data),
                ...EPHEMERAL,
            });

            return true;
        }

        return false;
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId !== PLAYTIME_EXCLUDE_SELECT_ID) return false;

        if (!isAdmin(interaction)) {
            await interaction.reply({
                content: "You do not have permission to manage the leaderboard.",
                ...EPHEMERAL,
            });
            return true;
        }

        const data = playtimeTracker.store.getData();
        const visibleMenuPlayers = Object.values(data.players || {})
            .sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0))
            .slice(0, 25);

        const selectedIds = new Set(interaction.values);

        for (const player of visibleMenuPlayers) {
            if (!player?.playerId) continue;
            playtimeTracker.store.setPlayerExcluded(player.playerId, selectedIds.has(player.playerId));
        }

        await playtimeTracker.updateEmbed();

        await interaction.update({
            content: "Excluded players updated.",
            components: [],
        });

        return true;
    }

    return false;
}