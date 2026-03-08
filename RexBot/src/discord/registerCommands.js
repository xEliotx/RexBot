import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { ping } from "./commands/ping.js";
import { setup } from "./commands/setup.js";
import { poptest } from "./commands/poptest.js";
import { postRules } from "./rules/postRulesCommand.js";
import { ticketPanel } from "./tickets/ticketPanelCommand.js";
import { rconplayers } from "./commands/rconplayers.js";

const commands = [
  ping.data.toJSON(),
  setup.data.toJSON(),
  poptest.data.toJSON(),
  rconplayers.data.toJSON(),
  postRules.data.toJSON(),
  ticketPanel.data.toJSON(),
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
