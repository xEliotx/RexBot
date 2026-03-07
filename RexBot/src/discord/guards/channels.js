import { EPHEMERAL } from "../util/ephemeral.js";

export const ChannelScope = Object.freeze({
  ADMIN: "ADMIN",
  ANY: "ANY",
});

export function channelAllowed(interaction, scope, channels) {
  if (scope === ChannelScope.ANY) return true;
  const channelId = interaction.channelId;
  if (!channelId) return false;
  if (scope === ChannelScope.ADMIN) return channelId === channels.adminChannelId;
  return false;
}

export async function requireChannel(interaction, scope, channels) {
  if (channelAllowed(interaction, scope, channels)) return true;

  const hint = scope === ChannelScope.ADMIN ? `<#${channels.adminChannelId}>` : "the correct channel";

  await interaction.reply({
    content: `Please use this in ${hint}.`,
    ...EPHEMERAL,
  }).catch(() => {});
  return false;
}
