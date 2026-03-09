import { EmbedBuilder } from "discord.js";
import speciesEmojis from "../../../config/speciesEmojis.js";
import speciesCategories from "../../../config/speciesCategories.js";

function formatSpeciesEntry(species, count) {
    const emoji = speciesEmojis[species] || "🦖";
    return `${emoji} **${species}**\n\`${count} Online\``;
}

function getCategoryTotals(speciesCounts) {
    let carnivores = 0;
    let herbivores = 0;
    let omnivores = 0;

    for (const [species, count] of Object.entries(speciesCounts)) {
        const category = speciesCategories[species];

        if (category === "Carnivore") carnivores += count;
        if (category === "Herbivore") herbivores += count;
        if (category === "Omnivore") omnivores += count;
    }

    return { carnivores, herbivores, omnivores };
}

function getTopSpeciesByCategory(speciesCounts, category) {
    let topSpecies = null;
    let topCount = 0;

    for (const [species, count] of Object.entries(speciesCounts)) {
        if (speciesCategories[species] !== category) continue;
        if (count > topCount) {
            topSpecies = species;
            topCount = count;
        }
    }

    return topSpecies ? { species: topSpecies, count: topCount } : null;
}

function getImbalanceText(carnivores, herbivores) {
    if (carnivores >= herbivores + 5 && herbivores > 0) {
        return "⚠️ Carnivore imbalance detected";
    }

    if (herbivores >= carnivores + 5 && carnivores > 0) {
        return "⚠️ Herbivore imbalance detected";
    }

    return "✅ Ecosystem balance stable";
}

export function buildPopulationEmbed(speciesCounts) {
    const sorted = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]);

    const embed = new EmbedBuilder()
        .setTitle("🌍 Blood & Bone Ecosystem Tracker")
        .setColor(0x57f287)
        .setFooter({
            text: `Population Dashboard • Updated: ${new Date().toLocaleString()}`,
        });

    if (!sorted.length) {
        embed.setDescription("⚫ No dinosaurs are currently online.");
        return embed;
    }

    const { carnivores, herbivores, omnivores } = getCategoryTotals(speciesCounts);

    const dominantCarnivore = getTopSpeciesByCategory(speciesCounts, "Carnivore");
    const dominantHerbivore = getTopSpeciesByCategory(speciesCounts, "Herbivore");

    const dominantCarnivoreText = dominantCarnivore
        ? `${speciesEmojis[dominantCarnivore.species] || "🦖"} **${dominantCarnivore.species}**`
        : "None";

    const dominantHerbivoreText = dominantHerbivore
        ? `${speciesEmojis[dominantHerbivore.species] || "🦕"} **${dominantHerbivore.species}**`
        : "None";

    const imbalanceText = getImbalanceText(carnivores, herbivores);

    embed.addFields({
        name: "🧬 Ecosystem Overview",
        value:
            `🍖 **Carnivores:** \`${carnivores}\`\n` +
            `🌿 **Herbivores:** \`${herbivores}\`\n` +
            `🍄 **Omnivores:** \`${omnivores}\`\n` +
            `🏆 **Dominant Carnivore:** ${dominantCarnivoreText}\n` +
            `🏆 **Dominant Herbivore:** ${dominantHerbivoreText}\n` +
            `\n${imbalanceText}`,
        inline: false,
    });

    const columns = [[], [], []];

    sorted.forEach(([species, count], i) => {
        columns[i % 3].push(formatSpeciesEntry(species, count));
    });

    embed.addFields(
        {
            name: "\u200B",
            value: columns[0].join("\n\n") || "\u200B",
            inline: true,
        },
        {
            name: "\u200B",
            value: columns[1].join("\n\n") || "\u200B",
            inline: true,
        },
        {
            name: "\u200B",
            value: columns[2].join("\n\n") || "\u200B",
            inline: true,
        }
    );

    return embed;
}