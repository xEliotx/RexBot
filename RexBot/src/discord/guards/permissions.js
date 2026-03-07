import { EPHEMERAL } from "../util/ephemeral.js";

export function isAdmin(interaction, adminRoleId) {
  const member = interaction.member;
  if (!member || !("roles" in member)) return false;
  return member.roles.cache?.has(adminRoleId) ?? false;
}

export function requireAdmin(interaction, adminRoleId) {
  if (isAdmin(interaction, adminRoleId)) return true;
  interaction.reply({
    content: "You don’t have permission to use this.",
    ...EPHEMERAL,
  }).catch(() => {});
  return false;
}
