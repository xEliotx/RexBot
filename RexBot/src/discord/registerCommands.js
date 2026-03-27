import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { setup } from "./commands/setup.js";
import { poptest } from "./commands/poptest.js";
import { postRules } from "./rules/postRulesCommand.js";
import { ticketPanel } from "./tickets/ticketPanelCommand.js";
import { rconplayers } from "./commands/rconplayers.js";
import { playerdata } from "./commands/playerdata.js";
import { dinoRolePanelCommand } from "./discord/roles/dinoRolePanelCommand.js";

const commands = [
  setup.data.toJSON(),
  poptest.data.toJSON(),
  rconplayers.data.toJSON(),
  postRules.data.toJSON(),
  ticketPanel.data.toJSON(),
  playerdata.data.toJSON(),
  dinoRolePanelCommand.data.toJSON(),
];

async function main() {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  logger.info("Registering slash commands to guild:", config.discord.guildId);

  await rest.put(
    Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
    { body: commands }
  );

  logger.info("Slash commands registered ✅");
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
