import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export function buildAdminModerationPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xD11A2A)
    .setTitle("Admin Controls")
    .setDescription("Kick, ban, announcements, and raw RCON tools.");

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:kick").setLabel("Kick").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("admin:ban").setLabel("Ban").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("admin:unban").setLabel("Unban").setStyle(ButtonStyle.Success),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("admin:announce").setLabel("Announce").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("admin:raw").setLabel("Raw RCON").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

export function buildAdminTokenPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xD17A1A)
    .setTitle("Admin Token Controls")
    .setDescription("Create, revoke, and purge dino storage tokens.");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("garage:admin:create_token").setLabel("Create Token").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("garage:admin:revoke_token").setLabel("Revoke Token").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("garage:admin:purge_inactive_tokens").setLabel("Purge Inactive").setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

export function buildDinoPanel() {
  const embed = new EmbedBuilder()
    .setTitle("Dino Storage")
    .setDescription(
      "Dino storage/restore is currently unavailable on standard Evrima hosting (RCON + FTP limitations).\n\n" +
      "Use this channel for player features as they’re added."
    );

  // Placeholder buttons for future features (disabled)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dino:store").setLabel("Store Dino").setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId("dino:list").setLabel("My Stored Dinos").setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId("dino:withdraw").setLabel("Withdraw Dino").setStyle(ButtonStyle.Secondary).setDisabled(true),
  );

  return { embeds: [embed], components: [row] };
}

export function buildLinkPanel(guild) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${guild?.name ?? "NO GUILD"}`,
      iconURL: guild?.iconURL?.({ dynamic: true, size: 128 }) ?? undefined,
    })
    .setColor('#1811f0')
    .setTitle("<:866146chain:1464985999083049121> Link your steam ID <:866146chain:1464985999083049121>")
    .setDescription(
      [
        "",
        " ❕Use the button below to **Verify** your steam.",
        "This will unlock features within the evrima server."
      ].join('\n')
    )
    .setImage('https://cdn.discordapp.com/attachments/1025125975316500500/1465414387119689869/test_banner_size.png?ex=697904ff&is=6977b37f&hm=385e3a35134950b699bad86453827b7800efc5abb0b7ba482ab4a877e19f2f19&')

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("link:start").setLabel("Link Steam64").setStyle(ButtonStyle.Primary).setEmoji("<:866146chain:1464985999083049121>"),
    new ButtonBuilder().setCustomId("link:status").setLabel("My Link Status").setStyle(ButtonStyle.Secondary).setEmoji("<:6806_exclamation:1465737468887171114>"),
  );

  return { embeds: [embed], components: [row] };
}


export function buildTokenPanel(guild) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${guild?.name ?? "NO GUILD"}`,
      iconURL: guild?.iconURL?.({ dynamic: true, size: 128 }) ?? undefined,
    })
    .setTitle("Tokens")
    .setColor(0x7f8512)
    .setDescription(
      "Use this channel to view and redeem your dino tokens.\n\n" +
      "• **My Tokens**: shows your unused tokens\n" +
      "• **Redeem Token**: redeem a token code (one-time use)"
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("garage:player:my_tokens").setLabel("My Tokens").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("garage:player:redeem").setLabel("Redeem Token").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("garage:player:store_dino").setLabel("Store Dino").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}
