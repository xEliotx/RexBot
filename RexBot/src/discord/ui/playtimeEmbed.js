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
export const PLAYTIME_REWARDS_BUTTON_ID = "playtime_rewards";

const LEADERBOARD_LIMIT = 10;
const EXCLUDE_MENU_LIMIT = 25;

export function formatDuration(totalSeconds = 0) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);

    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function rankPrefix(index) {
    if (index === 0) return "<a:gold:1492585414840549478>";
    if (index === 1) return "<a:silver:1492585372524220576>";
    if (index === 2) return "<a:bronze:1492585329721610320>";
    return `\`#${index + 1}\``;
}

function getSortedPlayers(storeData) {
    return Object.values(storeData.players || {}).sort(
        (a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0)
    );
}

function getVisiblePlayers(storeData) {
    return getSortedPlayers(storeData).filter(player => !player.excluded);
}

function getCurrentMonthLabel() {
    return new Date().toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
    });
}

export function buildPlaytimeEmbed(storeData) {
    const visiblePlayers = getVisiblePlayers(storeData);
    const topPlayers = visiblePlayers.slice(0, LEADERBOARD_LIMIT);

    const leaderboardText = topPlayers.length
        ? topPlayers
            .map((player, index) => {
                const prefix = rankPrefix(index);
                const time = formatDuration(player.totalSeconds || 0);
                return `${prefix} **${player.displayName}** — \`${time}\``;
            })
            .join("\n")
        : "*No playtime data yet this month.*";

    const totalTracked = visiblePlayers.length;
    const totalSeconds = visiblePlayers.reduce(
        (sum, player) => sum + (player.totalSeconds || 0),
        0
    );
    const totalPlaytimeText = formatDuration(totalSeconds);

    const lastReset = storeData.lastResetAt
        ? `<t:${Math.floor(new Date(storeData.lastResetAt).getTime() / 1000)}:D>`
        : "Not reset yet";

    const monthLabel = getCurrentMonthLabel();

    return new EmbedBuilder()
        .setColor("#f2ff00")
        .setTitle("🏆 Blood & Bone Playtime Leaderboard")
        .setThumbnail("https://media.discordapp.net/attachments/778652435227869214/1479990510142885928/logo.png?ex=69ae0c12&is=69acba92&hm=483be62858f6f38f6e94e7fecf3509578f65e3c5907c1c6be5884f90a5621e23&=&format=webp&quality=lossless&width=960&height=960")
        .setDescription(
            [
                `**${monthLabel}** • Top ${LEADERBOARD_LIMIT} tracked players`,
                "",
                leaderboardText,
            ].join("\n")
        )
        .addFields(
            {
                name: "👥 Players Tracked",
                value: `\`${totalTracked}\``,
                inline: true,
            },
            {
                name: "🕒 Combined Playtime",
                value: `\`${totalPlaytimeText}\``,
                inline: true,
            },
            {
                name: "🔄 Last Reset",
                value: lastReset,
                inline: true,
            }
        )
        .setFooter({
            text: "Excluded players are hidden • Updates every 10 minutes via RexBot",
        })
        .setTimestamp();
}

export function buildPlaytimeComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(PLAYTIME_EXCLUDE_BUTTON_ID)
                .setLabel("Manage Hidden Players")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(PLAYTIME_REWARDS_BUTTON_ID)
                .setLabel("Rewards")
                .setStyle(ButtonStyle.Primary),
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
    const players = getSortedPlayers(storeData).slice(0, EXCLUDE_MENU_LIMIT);

    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(PLAYTIME_EXCLUDE_SELECT_ID)
                .setPlaceholder("Choose players to hide from the leaderboard")
                .setMinValues(0)
                .setMaxValues(players.length || 1)
                .addOptions(
                    players.map((player, index) => ({
                        label: `${player.displayName}`.slice(0, 100),
                        description: `#${index + 1} • ${formatDuration(player.totalSeconds || 0)}${player.excluded ? " • Hidden" : ""}`.slice(0, 100),
                        value: player.playerId,
                        default: !!player.excluded,
                    }))
                )
        ),
    ];
}

export function buildPlaytimeRewardsEmbed() {
    return new EmbedBuilder()
        .setColor("#00d4ff")
        .setTitle("🎁 Monthly Leaderboard Rewards")
        .setDescription(
            [
                "Here are the rewards for this month's leaderboard:",
                "",
                "<a:gold:1492585414840549478> **1st Place** — £25 (PayPal)",
                "<a:silver:1492585372524220576> **2nd Place** — £10 (PayPal)",
                "<a:bronze:1492585329721610320> **3rd Place** — £5 Amazon Voucher",
                "",
                "",
                "*You must have your Steam account linked in Discord to be eligible — that’s all you need to do.*",
            ].join("\n")
        )
        .setFooter({
            text: "Rewards are based on final standings at the end of the month.",
        })
        .setTimestamp();
}