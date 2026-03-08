import { getSpeciesPopulation } from "../../rcon/getSpeciesPopulation.js";
import { buildPopulationEmbed } from "./populationEmbed.js";

let messageId = null;

export async function startPopulationUpdater({ client, rcon, channelId }) {
    const channel = await client.channels.fetch(channelId);

    const messages = await channel.messages.fetch({ limit: 20 });
    const existing = messages.find(
        (m) =>
            m.author.id === client.user.id &&
            m.embeds[0]?.footer?.text?.includes("Population Dashboard")
    );

    if (existing) {
        messageId = existing.id;
    }

    async function update() {
        try {
            const speciesCounts = await getSpeciesPopulation(rcon);
            const embed = buildPopulationEmbed(speciesCounts);

            if (!messageId) {
                const msg = await channel.send({ embeds: [embed] });
                messageId = msg.id;
            } else {
                const msg = await channel.messages.fetch(messageId);
                await msg.edit({ embeds: [embed] });
            }
        } catch (err) {
            console.error("Population updater error:", err);
        }
    }

    await update();
    setInterval(update, 60000);
}