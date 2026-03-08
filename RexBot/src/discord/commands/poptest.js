const { SlashCommandBuilder } = require("discord.js");
const { buildPopulationEmbed } = require("../stats/populationEmbed");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("poptest")
        .setDescription("Test the dinosaur population embed"),

    async execute(interaction) {

        const speciesCounts = {
            Carnotaurus: 14,
            Omniraptor: 11,
            Deinosuchus: 6,
            Stegosaurus: 9,
            Gallimimus: 3,
            Tyrannosaurus: 5,
            Ceratosaurus: 4
        };

        const embed = buildPopulationEmbed(speciesCounts);

        await interaction.reply({
            embeds: [embed]
        });

    }
};