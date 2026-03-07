import { NEW_PLAYER_GUIDE } from "./encyclopediaEntries.js";
import { upsertEncyclopediaEntry } from "./Encyclopedia.js";

export async function postNewPlayerGuide(client) {
  const channel = await client.channels.fetch(NEW_PLAYER_GUIDE.channelId).catch(() => null);
  if (!channel) throw new Error("Guide channel not found.");

  await upsertEncyclopediaEntry(channel, NEW_PLAYER_GUIDE.key, NEW_PLAYER_GUIDE.pages);
}
