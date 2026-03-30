import { EPHEMERAL } from "../util/ephemeral.js";

export const ChannelScope = Object.freeze({
  ADMIN: "ADMIN",
  ANY: "ANY",
  PLAYER_RECORDS: "PLAYER_RECORDS",
});

export function channelAllowed(interaction, scope, channels) {
  if (scope === ChannelScope.ANY) return true;

  const channelId = interaction.channelId;
  if (!channelId) return false;

  if (scope === ChannelScope.ADMIN) {
    return channelId === channels.adminChannelId;
  }

  if (scope === ChannelScope.PLAYER_RECORDS) {
    return channelId === channels.playerRecordsChannelId;
  }

  return false;
}

export async function requireChannel(interaction, scope, channels) {
  if (channelAllowed(interaction, scope, channels)) return true;

  let hint = "the correct channel";

  if (scope === ChannelScope.ADMIN) {
    hint = `<#${channels.adminChannelId}>`;
  } else if (scope === ChannelScope.PLAYER_RECORDS) {
    hint = `<#${channels.playerRecordsChannelId}>`;
  }

  await interaction.reply({
    content: `Please use this in ${hint}.`,
    ...EPHEMERAL,
  }).catch(() => { });
  return false;
}
