const { EmbedBuilder } = require("discord.js");
const speciesEmojis = require("../../../config/speciesEmojis");

function formatSpeciesEntry(species, count) {
    const emoji = speciesEmojis[species] || "🦖";
    return `${emoji} **${species}**\n\`${count} Online\``;
}

function buildPopulationEmbed(speciesCounts) {

    const sorted = Object.entries(speciesCounts)
        .sort((a, b) => b[1] - a[1]);

    const columns = [[], [], []];

    sorted.forEach(([species, count], i) => {
        columns[i % 3].push(formatSpeciesEntry(species, count));
    });

    const embed = new EmbedBuilder()
        .setTitle("Live Dinosaur Population")
        .setColor("#1e2430")
        .addFields(
            {
                name: "\u200B",
                value: columns[0].join("\n\n") || "\u200B",
                inline: true
            },
            {
                name: "\u200B",
                value: columns[1].join("\n\n") || "\u200B",
                inline: true
            },
            {
                name: "\u200B",
                value: columns[2].join("\n\n") || "\u200B",
                inline: true
            }
        )
        .setFooter({
            text: `Updated: ${new Date().toLocaleString()}`
        });

    return embed;
}

module.exports = { buildPopulationEmbed };