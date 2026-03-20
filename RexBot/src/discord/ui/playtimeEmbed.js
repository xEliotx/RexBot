import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} from "discord.js";

export const PLAYTIME_RESET_BUTTON_ID = "playtime_reset";
export const PLAYTIME_RESET_CONFIRM_BUTTON_ID = "playtime_reset_confirm";
export const PLAYTIME_RESET_CANCEL_BUTTON_ID = "playtime_reset_cancel";

export function formatDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

export function buildPlaytimeEmbed(storeData) {
    const players = Object.values(storeData.players || {})
        .sort((a, b) => b.totalSeconds - a.totalSeconds)
        .slice(0, 10);

    const description = players.length
        ? players
            .map((player, index) => {
                return `**${index + 1}.** ${player.displayName} — **${formatDuration(player.totalSeconds)}**`;
            })
            .join("\n")
        : "No playtime data yet.";

    const totalTracked = Object.keys(storeData.players || {}).length;
    const lastReset = storeData.lastResetAt
        ? `<t:${Math.floor(new Date(storeData.lastResetAt).getTime() / 1000)}:R>`
        : "Never";

    return new EmbedBuilder()
        .setTitle("RexBot Playtime Leaderboard")
        .setDescription(description)
        .addFields(
            { name: "Tracked Players", value: String(totalTracked), inline: true },
            { name: "Reset", value: "Monthly", inline: true },
            { name: "Last Reset", value: lastReset, inline: true }
        )
        .setFooter({ text: "Tracked via Evrima RCON player list" })
        .setTimestamp();
}

export function buildPlaytimeComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(PLAYTIME_RESET_BUTTON_ID)
                .setLabel("Reset Monthly Leaderboard")
                .setStyle(ButtonStyle.Danger)
        ),
    ];
}

export function buildPlaytimeResetConfirmComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(PLAYTIME_RESET_CONFIRM_BUTTON_ID)
                .setLabel("Confirm Reset")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(PLAYTIME_RESET_CANCEL_BUTTON_ID)
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary)
        ),
    ];
}