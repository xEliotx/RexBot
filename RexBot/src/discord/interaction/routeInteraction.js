import { CustomIdPrefix } from "./customIdPrefixes.js";
import { handleTicketButton } from "../tickets/ticketHandlers.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { handlePlaytimeResetButton } from "./playtimeResetButton.js";
import { handleDinoRoleSelect } from "../roles/dinoRoles.js";

export async function routeInteraction(interaction, ctx) {
  if (interaction.isButton()) {
    const handledPlaytime = await handlePlaytimeResetButton(interaction, {
      playtimeTracker: ctx.playtimeTracker,
    });

    if (handledPlaytime) return;

    if (interaction.customId.startsWith(CustomIdPrefix.TICKET)) {
      await handleTicketButton(interaction, ctx);
      return;
    }

    await interaction.reply({
      content: "This button is not wired yet.",
      ...EPHEMERAL,
    });
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const handledDinoRoles = await handleDinoRoleSelect(interaction, ctx);
    if (handledDinoRoles) return;

    if (interaction.customId.startsWith(CustomIdPrefix.TICKET)) {
      await handleTicketButton(interaction, ctx);
      return;
    }

    await interaction.reply({
      content: "This dropdown is not wired yet.",
      ...EPHEMERAL,
    });
    return;
  }

  if (interaction.isModalSubmit()) {
    await interaction
      .reply({
        content: "This modal is not wired yet.",
        ...EPHEMERAL,
      })
      .catch(() => { });
  }
}