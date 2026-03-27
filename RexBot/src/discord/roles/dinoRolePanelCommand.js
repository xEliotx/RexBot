import { buildDinoRolesMessage } from "./dinoRoles.js";

export default {
  data: {
    name: "dino-roles",
    description: "Post the dinosaur role selection panel",
  },

  async execute(interaction, ctx) {
    const staffRoleId = ctx.config.roles?.adminRoleId;
    const isStaff = staffRoleId
      ? interaction.member?.roles?.cache?.has(staffRoleId)
      : true;

    if (!isStaff) {
      await interaction.reply({
        content: "You do not have permission to use this command.",
        ephemeral: true,
      });
      return;
    }

    const payload = buildDinoRolesMessage(interaction.guild);
    await interaction.channel.send(payload);

    await interaction.reply({
      content: "Dinosaur role panel posted.",
      ephemeral: true,
    });
  },
};