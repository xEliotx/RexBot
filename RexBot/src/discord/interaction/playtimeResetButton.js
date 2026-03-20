import {
    PLAYTIME_RESET_BUTTON_ID,
    PLAYTIME_RESET_CONFIRM_BUTTON_ID,
    PLAYTIME_RESET_CANCEL_BUTTON_ID,
    buildPlaytimeResetConfirmComponents,
} from "../ui/playtimeEmbed.js";

function getAllowedRoleIds() {
    return String(process.env.PLAYTIME_RESET_ROLE_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
}

function memberCanReset(member) {
    const allowedRoleIds = getAllowedRoleIds();
    if (!allowedRoleIds.length) return false;

    return allowedRoleIds.some((roleId) => member.roles?.cache?.has(roleId));
}

export async function handlePlaytimeResetButton(interaction, { playtimeTracker }) {
    if (!interaction.isButton()) return false;

    if (interaction.customId === PLAYTIME_RESET_BUTTON_ID) {
        if (!memberCanReset(interaction.member)) {
            await interaction.reply({
                content: "You do not have permission to reset the playtime leaderboard.",
                ephemeral: true,
            });
            return true;
        }

        await interaction.reply({
            content: "Are you sure you want to reset the monthly playtime leaderboard? This cannot be undone.",
            components: buildPlaytimeResetConfirmComponents(),
            ephemeral: true,
        });
        return true;
    }

    if (interaction.customId === PLAYTIME_RESET_CONFIRM_BUTTON_ID) {
        if (!memberCanReset(interaction.member)) {
            await interaction.reply({
                content: "You do not have permission to reset the playtime leaderboard.",
                ephemeral: true,
            });
            return true;
        }

        await interaction.deferUpdate();

        try {
            await playtimeTracker.resetLeaderboard();

            await interaction.editReply({
                content: "Playtime leaderboard reset.",
                components: [],
            });
        } catch (error) {
            console.error("playtime reset failed:", error);

            await interaction.editReply({
                content: `Reset failed: ${error.message}`,
                components: [],
            });
        }

        return true;
    }

    if (interaction.customId === PLAYTIME_RESET_CANCEL_BUTTON_ID) {
        await interaction.update({
            content: "Reset cancelled.",
            components: [],
        });
        return true;
    }

    return false;
}