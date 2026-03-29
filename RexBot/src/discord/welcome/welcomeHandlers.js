import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} from "discord.js";
import { generateWelcomeImage } from "./welcomeImage.js";

/**
 * Picks one item from a weighted list.
 * Higher weight = more common
 */
function pickWeighted(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
        if (random < item.weight) return item; // return full object
        random -= item.weight;
    }

    // Fallback (should never happen, but keeps things safe)
    return items[0];
}

const hypeLines = [
    // COMMON
    { text: "<a:56125alert:1466517710543392849> APEX PREDATOR ENTERING THE HABITAT <a:56125alert:1466517710543392849>", weight: 18, tier: "common" },
    { text: "🦖 A NEW CREATURE HAS SPAWNED 🦖", weight: 18, tier: "common" },
    { text: "<a:31425fire:1470858756853071895> FRESH MEAT HAS ARRIVED <a:31425fire:1470858756853071895>", weight: 16, tier: "common" },
    { text: "⚠️ ECOSYSTEM STATUS: UNSTABLE ⚠️", weight: 14, tier: "common" },
    { text: "🧬 DNA SUCCESSFULLY INTEGRATED 🧬", weight: 14, tier: "common" },

    // RARE
    { text: "🌋 THE GROUND SHAKES… SOMETHING HAS JOINED 🌋", weight: 4, tier: "rare" },
    { text: "💀 SURVIVAL MODE: ENABLED 💀", weight: 3, tier: "rare" },
    { text: "🦴 THE FOOD CHAIN JUST SHIFTED 🦴", weight: 3, tier: "rare" },

    // LEGENDARY
    { text: "🏆 LEGENDARY SPAWN — 0.1% DROP RATE 🏆", weight: 1, tier: "legendary" },
    { text: "👁️ THE ECOSYSTEM WILL REMEMBER THIS DAY 👁️", weight: 0.5, tier: "legendary" },
];

export async function handleMemberJoin(member, { config, logger }) {
    const welcomeChannel = member.guild.channels.cache.get(
        "1462420531163693188"
    );
    if (!welcomeChannel) return;

    // 🎲 weighted hype selection
    const hypePick = pickWeighted(hypeLines);

    // Special colors by rarity
    const embedColor =
        hypePick.tier === "legendary" ? 0xffd700 : // gold
            hypePick.tier === "rare" ? 0x7c00ff :  // purple
                0xff0033;                          // your normal loud red

    const hype = hypePick.text;

    // Optional auto-role (fix: ensure autoRoleId is defined before use)
    const autoRoleId = config?.discord?.AUTO_ASSIGN_ROLE_ID;

    //Delete 63-81 if console logs are to much.
    logger.info("Auto-role config check:", {
        AUTO_ASSIGN_ROLE_ID: autoRoleId,
        truthy: Boolean(autoRoleId),
    });

    if (autoRoleId) {
        try {
            await member.roles.add(autoRoleId);
            logger.info(`Auto-role assigned: ${autoRoleId} -> ${member.user.tag}`);
        } catch (err) {
            logger.warn("Failed to auto-assign role", {
                message: err?.message,
                code: err?.code,
                status: err?.status,
                raw: err?.rawError,
            });
        }
    }

    const welcomeImageBuffer = await generateWelcomeImage({
        user: member.user,
        memberCount: member.guild.memberCount,
    });

    const welcomeImage = new AttachmentBuilder(welcomeImageBuffer, {
        name: "welcome.png",
    });


    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(hype)
        .setDescription([
            `**WELCOME <@${member.id}>**`,
            "You’ve entered the ecosystem. Survival is optional.",
			"",
            "> • **Announcements** → <#1465497725448491203>",
            "> • **Steam Linking** → <#1464629212764700844>",
            "> • **Dino-Storage** → <#1465518734780399787>",
            "> • **Reward-Center** → <#1479834219067998238>",
            "> • **Dino-Roles** → <#1487161842701963434>",
			"",
            "<a:3712rainbowreadrules:1470858722019508255> **Rules (READ THESE):**",
            "> • **General** → <#1462648417120682014>",
            "> • **Carnivore** → <#1462648847414202388>",
            "> • **Herbivore** → <#1462648723254411366>",
            "> • **Pack-Limits** → <#1466464861289447664>",
            "",
            "📔 **Encyclopedia**",
            "> • **New to the game?** → <#1469392438345859112>",
            "",
            "🤘 Say hi, lurk, or immediately cause problems (within the rules)."
        ].join("\n"))
        //.setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setImage("attachment://welcome.png")
        .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("📣 Announcements")
            .setStyle(ButtonStyle.Link)
            .setURL(
                `https://discord.com/channels/${member.guild.id}/1465497725448491203`
            ),
        new ButtonBuilder()
            .setLabel("🔗 Steam Linking")
            .setStyle(ButtonStyle.Link)
            .setURL(
                `https://discord.com/channels/${member.guild.id}/1464629212764700844`
            ),
        new ButtonBuilder()
            .setLabel("📜 Rules")
            .setStyle(ButtonStyle.Link)
            .setURL(
                `https://discord.com/channels/${member.guild.id}/1462648417120682014`
            )
    );

    await welcomeChannel.send({
        embeds: [embed],
        components: [buttons],
        files: [welcomeImage],
        allowedMentions: { users: [member.id] },
    });
}
