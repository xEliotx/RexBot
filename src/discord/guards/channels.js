import { EPHEMERAL } from "../util/ephemeral.js";

export const ChannelScope = Object.freeze({
  ADMIN: "ADMIN",
  DINO: "DINO",
  LINK: "LINK",
  TOKENS: "TOKENS",
  ANY: "ANY",
});

export function channelAllowed(interaction, scope, channels) {
  if (scope === ChannelScope.ANY) return true;

  const channelId = interaction.channelId;
  if (!channelId) return false;

  if (scope === ChannelScope.ADMIN) return channelId === channels.adminChannelId;
  if (scope === ChannelScope.DINO) return channelId === channels.dinoChannelId;
  if (scope === ChannelScope.LINK) return channelId === channels.linkChannelId;
  if (scope === ChannelScope.TOKENS) return channelId === channels.tokensChannelId;

  return false;
}

export async function requireChannel(interaction, scope, channels) {
  if (channelAllowed(interaction, scope, channels)) return true;

  const hint =
    scope === ChannelScope.ADMIN ? `<#${channels.adminChannelId}>` :
    scope === ChannelScope.DINO ? `<#${channels.dinoChannelId}>` :
    scope === ChannelScope.LINK ? `<#${channels.linkChannelId}>` :
    scope === ChannelScope.TOKENS ? `<#${channels.tokensChannelId}>` :
    "the correct channel";

  await interaction.reply({
    content: `Please use this in ${hint}.`,
    ...EPHEMERAL,
  }).catch(() => {});
  return false;
}
