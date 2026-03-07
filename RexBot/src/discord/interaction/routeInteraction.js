import { handleAdminButton, handleAdminModal, handleAdminSelect } from "../admin/adminHandlers.js";
import { handleLinkButton, handleLinkModal } from "../link/linkHandlers.js";
import { handleGarageButton, handleGarageModal, handleGarageSelect } from "../garage/garageHandlers.js";

import { requireChannel, ChannelScope } from "../guards/channels.js";
import { requireAdmin } from "../guards/permissions.js";
import { CustomIdPrefix } from "./customIdPrefixes.js";
import { EPHEMERAL } from "../util/ephemeral.js";
import { handleTicketButton } from "../tickets/ticketHandlers.js";


/**
 * Routes non-slash interactions (buttons/selects/modals) based on customId prefix.
 * Keeps src/index.js small and makes it easier to add new modules.
 */
export async function routeInteraction(interaction, ctx) {
  const { config } = ctx;

  // Buttons
  if (interaction.isButton()) {
    if (interaction.customId.startsWith(CustomIdPrefix.ADMIN)) {
      if (!requireAdmin(interaction, config.roles.adminRoleId)) return;
      if (!(await requireChannel(interaction, ChannelScope.ADMIN, config.channels))) return;
      await handleAdminButton(interaction, ctx);
      return;
    }

    if (interaction.customId.startsWith(CustomIdPrefix.LINK)) {
      if (!(await requireChannel(interaction, ChannelScope.LINK, config.channels))) return;
      await handleLinkButton(interaction, ctx);
      return;
    }

    if (interaction.customId.startsWith(CustomIdPrefix.TICKET)) {
      await handleTicketButton(interaction, ctx);
      return;
    }


    if (interaction.customId.startsWith(CustomIdPrefix.GARAGE)) {
      // Admin garage actions live in the admin channel; player actions in the tokens channel.
      if (interaction.customId.startsWith("garage:admin:")) {
        if (!requireAdmin(interaction, config.roles.adminRoleId)) return;
        if (!(await requireChannel(interaction, ChannelScope.ADMIN, config.channels))) return;
      } else {
        if (!(await requireChannel(interaction, ChannelScope.TOKENS, config.channels))) return;
      }
      await handleGarageButton(interaction, ctx);
      return;
    }

    await interaction.reply({ content: "This button is not wired yet.", ...EPHEMERAL });
    return;
  }

  // Dropdowns
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith(CustomIdPrefix.ADMIN)) {
      if (!requireAdmin(interaction, config.roles.adminRoleId)) return;
      if (!(await requireChannel(interaction, ChannelScope.ADMIN, config.channels))) return;
      await handleAdminSelect(interaction, ctx);
      return;
    }

    if (interaction.customId.startsWith(CustomIdPrefix.GARAGE)) {
      if (interaction.customId.startsWith("garage:admin:")) {
        if (!requireAdmin(interaction, config.roles.adminRoleId)) return;
        if (!(await requireChannel(interaction, ChannelScope.ADMIN, config.channels))) return;
      } else {
        if (!(await requireChannel(interaction, ChannelScope.TOKENS, config.channels))) return;
      }
      await handleGarageSelect(interaction, ctx);
      return;
    }

    if (interaction.customId.startsWith(CustomIdPrefix.TICKET)) {
      await handleTicketButton(interaction, ctx);
      return;
    }

    await interaction.reply({ content: "This dropdown is not wired yet.", ...EPHEMERAL });
    return;
  }

  // Modals
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith(CustomIdPrefix.ADMIN)) {
      if (!requireAdmin(interaction, config.roles.adminRoleId)) return;
      if (!(await requireChannel(interaction, ChannelScope.ADMIN, config.channels))) return;
      await handleAdminModal(interaction, ctx);
      return;
    }

    if (interaction.customId.startsWith(CustomIdPrefix.LINK)) {
      if (!(await requireChannel(interaction, ChannelScope.LINK, config.channels))) return;
      await handleLinkModal(interaction, ctx);
      return;
    }

    if (interaction.customId.startsWith(CustomIdPrefix.GARAGE)) {
      if (interaction.customId.startsWith("garage:admin:")) {
        if (!requireAdmin(interaction, config.roles.adminRoleId)) return;
        if (!(await requireChannel(interaction, ChannelScope.ADMIN, config.channels))) return;
      } else {
        if (!(await requireChannel(interaction, ChannelScope.TOKENS, config.channels))) return;
      }
      await handleGarageModal(interaction, ctx);
      return;
    }

    await interaction.reply({ content: "This modal is not wired yet.", ...EPHEMERAL });
  }
}
