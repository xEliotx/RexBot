import { CustomIdPrefix } from "./customIdPrefixes.js";
import { handleTicketButton } from "../tickets/ticketHandlers.js";
import { EPHEMERAL } from "../util/ephemeral.js";

export async function routeInteraction(interaction, ctx) {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith(CustomIdPrefix.TICKET)) {
      await handleTicketButton(interaction, ctx);
      return;
    }
    await interaction.reply({ content: "This button is not wired yet.", ...EPHEMERAL });
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith(CustomIdPrefix.TICKET)) {
      await handleTicketButton(interaction, ctx);
      return;
    }
    await interaction.reply({ content: "This dropdown is not wired yet.", ...EPHEMERAL });
    return;
  }

  if (interaction.isModalSubmit()) {
    await interaction.reply({ content: "This modal is not wired yet.", ...EPHEMERAL }).catch(() => {});
  }
}
