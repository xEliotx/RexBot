import { MessageFlags } from "discord.js";

// discord.js is deprecating the `ephemeral: true` shortcut on interaction responses.
// Use this helper everywhere to keep the codebase consistent.
export const EPHEMERAL = { flags: MessageFlags.Ephemeral };
