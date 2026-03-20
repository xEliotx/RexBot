import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { createClient } from "./discord/client.js";

import { ping } from "./discord/commands/ping.js";
import { setup } from "./discord/commands/setup.js";
import { postRules } from "./discord/rules/postRulesCommand.js";
import { handleNewPlayerGuideBookButtons } from "./discord/rules/NewPlayerGuideBook.js";
import { startPopulationUpdater } from "./discord/stats/populationUpdater.js";
import { startDeathLogWatcher } from "./logs/deathLogWatcher.js";
import { PlaytimeStore } from "./storage/playtimeStore.js";
import { PlaytimeTracker } from "./rcon/playtimeTracker.js";
import { setupplaytime } from "./discord/commands/setupplaytime.js";

import { EvrimaRconClient } from "./rcon/rconClient.js";
import { requireChannel } from "./discord/guards/channels.js";
import { startStatusEmbedUpdater } from "./discord/stats/statusEmbed.js";
import { routeInteraction } from "./discord/interaction/routeInteraction.js";
import { EPHEMERAL } from "./discord/util/ephemeral.js";
import { handleMemberJoin } from "./discord/welcome/welcomeHandlers.js";
import { ticketPanel } from "./discord/tickets/ticketPanelCommand.js";
import { startTicketInactivityWatcher } from "./discord/tickets/ticketInactivity.js";
import { playerdata } from "./discord/commands/playerdata.js";

const client = createClient();

const rcon = new EvrimaRconClient({
  host: config.rcon.host,
  port: config.rcon.port,
  password: config.rcon.password,
  logger,
});

const playtimeStore = new PlaytimeStore();

const playtimeTracker = new PlaytimeTracker({
  client,
  rcon,
  store: playtimeStore,
  channelId: process.env.PLAYTIME_CHANNEL_ID,
});

const session = new Map();

const commandMap = new Map([
  [ping.data.name, ping],
  [setup.data.name, setup],
  [playerdata.data.name, playerdata],
  [postRules.data.name, postRules],
  [ticketPanel.data.name, ticketPanel],
  [setupplaytime.data.name, setupplaytime],
]);

client.once("clientready", () => {
  logger.info(`Logged in as ${client.user.tag}`);
  startStatusEmbedUpdater({ client, rcon, logger });
  startTicketInactivityWatcher({ client, config, logger });
  startPopulationUpdater({ client, rcon, channelId: "1479972419157491832" });
  startDeathLogWatcher({
    client, logFilePath: "C:/Users/Administrator/Desktop/TheIsleServer/TheIsle/Saved/Logs/TheIsle.log", channelId: "1480218203857752265", logger,
  });
  playtimeTracker.start();
});

client.on("interactionCreate", async (interaction) => {
  try {
    const ctx = { config, client, rcon, session, playtimeTracker };

    if (interaction.isChatInputCommand()) {
      const cmd = commandMap.get(interaction.commandName);
      if (!cmd) return;
      if (!(await requireChannel(interaction, cmd.scope, config.channels))) return;
      await cmd.execute(interaction, ctx);
      return;
    }

    const handled = await handleNewPlayerGuideBookButtons(interaction);
    if (handled) return;

    await routeInteraction(interaction, ctx);
  } catch (err) {
    logger.error("interactionCreate error:", err);

    if (interaction.isRepliable()) {
      const already = interaction.deferred || interaction.replied;

      const payload = {
        content: "Something went wrong. Check the bot logs.",
        ...EPHEMERAL,
      };

      try {
        if (already) await interaction.followUp(payload);
        else await interaction.reply(payload);
      } catch { }
    }
  }
});

client.login(config.discord.token)
  .then(() => client.emit("clientready"))
  .catch((e) => {
    logger.error("Failed to login:", e);
    process.exit(1);
  });

client.on("guildMemberAdd", async (member) => {
  try {
    await handleMemberJoin(member, { config, logger });
  } catch (err) {
    logger.error("Welcome system error:", err);
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    const ch = message.channel;
    if (!ch?.isTextBased?.()) return;

    const topic = ch.topic ?? "";
    if (!topic.includes("ticket_owner=")) return;

    const now = Date.now();
    const last = Number(topic.match(/last_activity=(\d+)/)?.[1] ?? 0);
    if (now - last < 60_000) return;

    let newTopic = topic.includes("last_activity=")
      ? topic.replace(/last_activity=\d+/, `last_activity=${now}`)
      : `${topic};last_activity=${now}`;

    newTopic = newTopic.includes("warned=")
      ? newTopic.replace(/warned=\d+/, "warned=0")
      : `${newTopic};warned=0`;

    await ch.setTopic(newTopic);
  } catch {
    // ignore
  }
});
