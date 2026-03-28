import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from "discord.js";

export const PLAYTIME_RESET_BUTTON_ID = "playtime_reset";
export const PLAYTIME_RESET_CONFIRM_BUTTON_ID = "playtime_reset_confirm";
export const PLAYTIME_RESET_CANCEL_BUTTON_ID = "playtime_reset_cancel";
export const PLAYTIME_EXCLUDE_BUTTON_ID = "playtime_exclude";
export const PLAYTIME_EXCLUDE_SELECT_ID = "playtime_exclude_select";

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
    const visiblePlayers = allPlayers.filter(player => !player.excluded);

    const topPlayers = [...visiblePlayers]
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

    const totalTracked = visiblePlayers.length;
    const totalSeconds = visiblePlayers.reduce(
        (sum, p) => sum + (p.totalSeconds || 0),
        0
    );
    const totalPlaytimeText = formatDuration(totalSeconds);

    const lastReset = storeData.lastResetAt
        ? `<t:${Math.floor(new Date(storeData.lastResetAt).getTime() / 1000)}:D>`
        : "Not reset yet";

    return new EmbedBuilder()
        .setColor("#f2ff00")
        .setTitle("🏆 Blood & Bone Monthly Playtime Leaderboard")
        .setThumbnail("https://media.discordapp.net/attachments/778652435227869214/1479990510142885928/logo.png?ex=69ae0c12&is=69acba92&hm=483be62858f6f38f6e94e7fecf3509578f65e3c5907c1c6be5884f90a5621e23&=&format=webp&quality=lossless&width=960&height=960")
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
                name: "🕒 Total Playtime",
                value: `**${totalPlaytimeText}**`,
                inline: true,
            },
            {
                name: "🔄 Last Reset",
                value: lastReset,
                inline: true,
            }
        )
        .setFooter({
            text: "Updates every 10 minutes 🟢 Tracked via RexBot",
        })
        .setTimestamp();
}

export function buildPlaytimeComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(PLAYTIME_EXCLUDE_BUTTON_ID)
                .setLabel("Exclude Players")
                .setStyle(ButtonStyle.Secondary),
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

export function buildPlaytimeExcludeMenu(storeData) {
    const players = Object.values(storeData.players || {})
        .sort((a, b) => b.totalSeconds - a.totalSeconds)
        .slice(0, 10);

    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(PLAYTIME_EXCLUDE_SELECT_ID)
                .setPlaceholder("Select players to exclude")
                .setMinValues(0)
                .setMaxValues(players.length || 1)
                .addOptions(
                    players.map((player, index) => ({
                        label: `#${index + 1} ${player.displayName}`,
                        description: `${formatDuration(player.totalSeconds)}${player.excluded ? " • Excluded" : ""}`,
                        value: player.playerId,
                        default: !!player.excluded,
                    }))
                )
        ),
    ];
}