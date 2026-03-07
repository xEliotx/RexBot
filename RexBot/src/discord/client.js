import { Client, GatewayIntentBits } from "discord.js";

export function createClient() {
  // Keep intents minimal. We can add more later if needed.
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });
}
