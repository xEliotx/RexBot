import { PermissionFlagsBits } from "discord.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import {
    PLAYTIME_EXCLUDE_BUTTON_ID,
    PLAYTIME_EXCLUDE_SELECT_ID,
    buildPlaytimeExcludeMenu,
} from "../ui/playtimeEmbed.js";

function isAdmin(interaction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

export async function handlePlaytimeAdminInteraction(interaction, { playtimeTracker }) {
    if (interaction.isButton()) {
        if (interaction.customId !== PLAYTIME_EXCLUDE_BUTTON_ID) return false;

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

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId !== PLAYTIME_EXCLUDE_SELECT_ID) return false;

        if (!isAdmin(interaction)) {
            await interaction.reply({
                content: "You do not have permission to manage the leaderboard.",
                ...EPHEMERAL,
            });
            return true;
        }

        playtimeTracker.store.setExcludedPlayers(interaction.values);
        await playtimeTracker.updateEmbed();

        await interaction.update({
            content: "Excluded players updated.",
            components: [],
        });

        return true;
    }

    return false;
}