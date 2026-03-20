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

    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function rankPrefix(index) {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `\`${String(index + 1).padStart(2, " ")}\``;
}

export function buildPlaytimeEmbed(storeData) {
    const allPlayers = Object.values(storeData.players || {});
    const topPlayers = [...allPlayers]
        .sort((a, b) => b.totalSeconds - a.totalSeconds)
        .slice(0, 10);

    const leaderboardText = topPlayers.length
        ? topPlayers
            .map((player, index) => {
                const prefix = rankPrefix(index);
                return `${prefix} **${player.displayName}**\n└ ${formatDuration(player.totalSeconds)}`;
            })
            .join("\n\n")
        : "*No playtime data yet this month.*";

    const totalTracked = allPlayers.length;
    const totalHours = Math.floor(
        allPlayers.reduce((sum, p) => sum + (p.totalSeconds || 0), 0) / 3600
    );

    const lastReset = storeData.lastResetAt
        ? `<t:${Math.floor(new Date(storeData.lastResetAt).getTime() / 1000)}:D>`
        : "Not reset yet";

    return new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🏆 RexBot Monthly Playtime Leaderboard")
        .setDescription(
            [
                "Top 10 players by tracked monthly playtime.",
                "",
                leaderboardText,
            ].join("\n")
        )
        .addFields(
            {
                name: "📊 Tracked Players",
                value: `**${totalTracked}**`,
                inline: true,
            },
            {
                name: "🕒 Total Hours",
                value: `**${totalHours}h**`,
                inline: true,
            },
            {
                name: "🔄 Last Reset",
                value: lastReset,
                inline: true,
            }
        )
        .setFooter({
            text: "Updates hourly 🟢 Tracked via Evrima RCON",
        })
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