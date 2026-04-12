import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from "discord.js";

const CARNIVORE_OPTIONS = [
    {
        label: "Allosaurus",
        value: "allo",
        description: "Toggle the Allosaurus ping role",
        emoji: { id: "1480158072750997637", name: "allosaurus" },
    },
    {
        label: "Carnotaurus",
        value: "carno",
        description: "Toggle the Carnotaurus ping role",
        emoji: { id: "1480158193136042245", name: "carnotaurus" },
    },
    {
        label: "Ceratosaurus",
        value: "cerato",
        description: "Toggle the Ceratosaurus ping role",
        emoji: { id: "1480158246462427166", name: "ceratosaurus" },
    },
    {
        label: "Deinosuchus",
        value: "deino",
        description: "Toggle the Deinosuchus ping role",
        emoji: { id: "1480158292746436709", name: "deinosuchus" },
    },
    {
        label: "Dilophosaurus",
        value: "dilo",
        description: "Toggle the Dilophosaurus ping role",
        emoji: { id: "1480158396505133189", name: "dilophosaurus" },
    },
    {
        label: "Herrerasaurus",
        value: "herrera",
        description: "Toggle the Herrerasaurus ping role",
        emoji: { id: "1480158548381007922", name: "herrerasaurus" },
    },
    {
        label: "Omniraptor",
        value: "omni",
        description: "Toggle the Omniraptor ping role",
        emoji: { id: "1480158670095519744", name: "omniraptor" },
    },
    {
        label: "Troodon",
        value: "troodon",
        description: "Toggle the Troodon ping role",
        emoji: { id: "1480158929303507065", name: "troodon" },
    },
    {
        label: "Tyrannosaurus",
        value: "rex",
        description: "Toggle the Tyrannosaurus ping role",
        emoji: { id: "1480158990049480896", name: "tyrannosaurus" },
    },
    {
        label: "Pteranodon",
        value: "ptera",
        description: "Toggle the Pteranodon ping role",
        emoji: { id: "1480158754954543214", name: "pteranodon" },
    },
];

const HERBIVORE_OPTIONS = [
    {
        label: "Diabloceratops",
        value: "diablo",
        description: "Toggle the Diabloceratops ping role",
        emoji: { id: "1480158351731068989", name: "diabloceratops" },
    },
    {
        label: "Dryosaurus",
        value: "dryo",
        description: "Toggle the Dryosaurus ping role",
        emoji: { id: "1480158443255103572", name: "dryosaurus" },
    },
    {
        label: "Hypsilophodon",
        value: "hypsi",
        description: "Toggle the Hypsilophodon ping role",
        emoji: { id: "1480158594975531089", name: "hypsilophodon" },
    },
    {
        label: "Maiasaura",
        value: "maia",
        description: "Toggle the Maiasaura ping role",
        emoji: { id: "1480158627342843984", name: "maiasaura" },
    },
    {
        label: "Pachycephalosaurus",
        value: "pachy",
        description: "Toggle the Pachycephalosaurus ping role",
        emoji: { id: "1480158719756206093", name: "pachycephalosaurus" },
    },
    {
        label: "Stegosaurus",
        value: "stego",
        description: "Toggle the Stegosaurus ping role",
        emoji: { id: "1480158792581648394", name: "stegosaurus" },
    },
    {
        label: "Tenontosaurus",
        value: "teno",
        description: "Toggle the Tenontosaurus ping role",
        emoji: { id: "1480158838853206016", name: "tenontosaurus" },
    },
    {
        label: "Triceratops",
        value: "trike",
        description: "Toggle the Triceratops ping role",
        emoji: { id: "1480158885347201095", name: "triceratops" },
    },
];

const OMNIVORE_OPTIONS = [
    {
        label: "Beipiaosaurus",
        value: "beipiao",
        description: "Toggle the Beipiaosaurus ping role",
        emoji: { id: "1480158137444208732", name: "beipiaosaurus" },
    },
    {
        label: "Gallimimus",
        value: "galli",
        description: "Toggle the Gallimimus ping role",
        emoji: { id: "1480158513723342909", name: "gallimimus" },
    },
];

function getRoleMap(config) {
    return {
        allo: config.roles?.dinoRoles?.allo ?? "",
        beipiao: config.roles?.dinoRoles?.beipiao ?? "",
        carno: config.roles?.dinoRoles?.carno ?? "",
        cerato: config.roles?.dinoRoles?.cerato ?? "",
        deino: config.roles?.dinoRoles?.deino ?? "",
        diablo: config.roles?.dinoRoles?.diablo ?? "",
        dilo: config.roles?.dinoRoles?.dilo ?? "",
        dryo: config.roles?.dinoRoles?.dryo ?? "",
        galli: config.roles?.dinoRoles?.galli ?? "",
        herrera: config.roles?.dinoRoles?.herrera ?? "",
        hypsi: config.roles?.dinoRoles?.hypsi ?? "",
        maia: config.roles?.dinoRoles?.maia ?? "",
        omni: config.roles?.dinoRoles?.omni ?? "",
        pachy: config.roles?.dinoRoles?.pachy ?? "",
        ptera: config.roles?.dinoRoles?.ptera ?? "",
        rex: config.roles?.dinoRoles?.rex ?? "",
        stego: config.roles?.dinoRoles?.stego ?? "",
        teno: config.roles?.dinoRoles?.teno ?? "",
        trike: config.roles?.dinoRoles?.trike ?? "",
        troodon: config.roles?.dinoRoles?.troodon ?? "",
    };
}

function getCurrentDinoRoleNames(member, guild, config) {
    const roleMap = getRoleMap(config);
    const currentNames = Object.values(roleMap)
        .filter(Boolean)
        .filter((roleId) => member.roles.cache.has(roleId))
        .map((roleId) => guild.roles.cache.get(roleId)?.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return currentNames;
}

export function buildDinoRolesMessage(guild) {
    const embed = new EmbedBuilder()
        .setColor("#9e18d3")
        .setAuthor({
            name: guild?.name ?? "Role Selection",
            iconURL: guild?.iconURL?.() ?? undefined,
        })
        .setTitle("Dinosaur Roles")
        .setImage("https://cdn.discordapp.com/attachments/778652435227869214/1487194622147952784/DinoRoles.png?ex=69c8416c&is=69c6efec&hm=c8c21f14660f8bedcc3d40c941cb4d869974b7927c35ba77ba7f6f1b885a46bb&")
        .setDescription(
            [
                "**Select a dinosaur below to toggle its ping role.**",
                "",
                "> • Select once to **add** the role",
                "> • Select again later to **remove** it",
                "> • Use the **add all dino roles** button if you want a ping for every dino.",
                "> • Use the **remove all dino roles** button if you want to delete all dino's.",
                "> • You can have **multiple** dinosaur roles at the same time",
            ].join("\n")
        );

    const carnivoreMenu = new StringSelectMenuBuilder()
        .setCustomId("dino-role:carnivores")
        .setPlaceholder("🩸 Select Carnivore Roles")
        .addOptions(CARNIVORE_OPTIONS);

    const herbivoreMenu = new StringSelectMenuBuilder()
        .setCustomId("dino-role:herbivores")
        .setPlaceholder("🌿 Select Herbivore Roles")
        .addOptions(HERBIVORE_OPTIONS);

    const omnivoreMenu = new StringSelectMenuBuilder()
        .setCustomId("dino-role:omnivores")
        .setPlaceholder("🍖🌿 Select Omnivore Roles")
        .addOptions(OMNIVORE_OPTIONS);

    const carnivoreRow = new ActionRowBuilder().addComponents(carnivoreMenu);
    const herbivoreRow = new ActionRowBuilder().addComponents(herbivoreMenu);
    const omnivoreRow = new ActionRowBuilder().addComponents(omnivoreMenu);

    const addAllButton = new ButtonBuilder()
        .setCustomId("dino-role:add-all")
        .setLabel("Add All Dino Roles")
        .setStyle(ButtonStyle.Success);

    const removeAllButton = new ButtonBuilder()
        .setCustomId("dino-role:remove-all")
        .setLabel("Remove All Dino Roles")
        .setStyle(ButtonStyle.Danger);

    const buttonRow = new ActionRowBuilder().addComponents(addAllButton, removeAllButton);

    return {
        embeds: [embed],
        components: [carnivoreRow, herbivoreRow, omnivoreRow, buttonRow],
    };
}

export async function handleDinoRoleSelect(interaction, ctx) {
    if (!interaction.isStringSelectMenu()) return false;

    if (
        interaction.customId !== "dino-role:carnivores" &&
        interaction.customId !== "dino-role:herbivores" &&
        interaction.customId !== "dino-role:omnivores"
    ) {
        return false;
    }

    const selected = interaction.values?.[0];
    const roleMap = getRoleMap(ctx.config);
    const roleId = roleMap[selected];

    if (!roleId) {
        await interaction.reply({
            content: "That role is not configured yet.",
            ephemeral: true,
        });
        return true;
    }

    const member = interaction.member;
    const guild = interaction.guild;

    if (!guild || !member || !member.roles) {
        await interaction.reply({
            content: "I couldn't update your role.",
            ephemeral: true,
        });
        return true;
    }

    const hasRole = member.roles.cache.has(roleId);

    try {
        const role = guild.roles.cache.get(roleId);
        let actionText = "";

        if (hasRole) {
            await member.roles.remove(roleId);
            actionText = `❌ Removed ${role ? role.name : "role"}.`;
        } else {
            await member.roles.add(roleId);
            actionText = `✅ Added ${role ? role.name : "role"}.`;
        }

        const freshMember = await guild.members.fetch(member.id);
        const currentRoleNames = getCurrentDinoRoleNames(freshMember, guild, ctx.config);
        const currentRolesText = currentRoleNames.length
            ? `Current dino roles: ${currentRoleNames.join(", ")}`
            : "Current dino roles: none";

        const refreshedPayload = buildDinoRolesMessage(guild);

        await interaction.update({
            embeds: refreshedPayload.embeds,
            components: refreshedPayload.components,
        });

        await interaction.followUp({
            content: `${actionText}\n${currentRolesText}`,
            ephemeral: true,
        });
    } catch (err) {
        ctx.logger?.error?.("Failed to toggle dino role:", err);

        await interaction.followUp({
            content: "I couldn't update your role. Check my permissions and role order.",
            ephemeral: true,
        }).catch(() => { });
    }
    return true;
}

export async function handleDinoRoleAddAll(interaction, ctx) {
    if (!interaction.isButton()) return false;
    if (interaction.customId !== "dino-role:add-all") return false;

    const roleMap = getRoleMap(ctx.config);
    const roleIds = Object.values(roleMap).filter(Boolean);

    const member = interaction.member;
    const guild = interaction.guild;

    if (!guild || !member || !member.roles) {
        await interaction.reply({
            content: "I couldn't update your roles.",
            ephemeral: true,
        });
        return true;
    }

    const rolesToAdd = roleIds.filter((roleId) => !member.roles.cache.has(roleId));

    try {
        if (!rolesToAdd.length) {
            const currentRoleNames = getCurrentDinoRoleNames(member, guild, ctx.config);
            const currentRolesText = currentRoleNames.length
                ? `Current dino roles: ${currentRoleNames.join(", ")}`
                : "Current dino roles: none";

            await interaction.reply({
                content: `You already have all dinosaur roles.\n${currentRolesText}`,
                ephemeral: true,
            });
            return true;
        }

        await member.roles.add(rolesToAdd);

        const refreshedPayload = buildDinoRolesMessage(guild);

        await interaction.update({
            embeds: refreshedPayload.embeds,
            components: refreshedPayload.components,
        });

        const freshMember = await guild.members.fetch(member.id);
        const currentRoleNames = getCurrentDinoRoleNames(freshMember, guild, ctx.config);
        const currentRolesText = currentRoleNames.length
            ? `Current dino roles: ${currentRoleNames.join(", ")}`
            : "Current dino roles: none";

        await interaction.followUp({
            content: `✅ Added all dinosaur roles.\n${currentRolesText}`,
            ephemeral: true,
        });
    } catch (err) {
        ctx.logger?.error?.("Failed to add all dino roles:", err);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "I couldn't add your dinosaur roles. Check my permissions and role order.",
                ephemeral: true,
            }).catch(() => { });
        } else {
            await interaction.reply({
                content: "I couldn't add your dinosaur roles. Check my permissions and role order.",
                ephemeral: true,
            }).catch(() => { });
        }
    }

    return true;
}

export async function handleDinoRoleRemoveAll(interaction, ctx) {
    if (!interaction.isButton()) return false;
    if (interaction.customId !== "dino-role:remove-all") return false;

    const roleMap = getRoleMap(ctx.config);
    const roleIds = Object.values(roleMap).filter(Boolean);

    const member = interaction.member;
    const guild = interaction.guild;

    if (!guild || !member || !member.roles) {
        await interaction.reply({
            content: "I couldn't update your roles.",
            ephemeral: true,
        });
        return true;
    }

    const rolesToRemove = roleIds.filter((roleId) => member.roles.cache.has(roleId));

    try {
        if (!rolesToRemove.length) {
            await interaction.reply({
                content: "You do not currently have any dinosaur roles.\nCurrent dino roles: none",
                ephemeral: true,
            });
            return true;
        }

        await member.roles.remove(rolesToRemove);

        const refreshedPayload = buildDinoRolesMessage(guild);

        await interaction.update({
            embeds: refreshedPayload.embeds,
            components: refreshedPayload.components,
        });

        const freshMember = await guild.members.fetch(member.id);
        const currentRoleNames = getCurrentDinoRoleNames(freshMember, guild, ctx.config);
        const currentRolesText = currentRoleNames.length
            ? `Current dino roles: ${currentRoleNames.join(", ")}`
            : "Current dino roles: none";

        await interaction.followUp({
            content: `❌ Removed all dinosaur roles.\n${currentRolesText}`,
            ephemeral: true,
        });
    } catch (err) {
        ctx.logger?.error?.("Failed to remove all dino roles:", err);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "I couldn't remove your dinosaur roles. Check my permissions and role order.",
                ephemeral: true,
            }).catch(() => { });
        } else {
            await interaction.reply({
                content: "I couldn't remove your dinosaur roles. Check my permissions and role order.",
                ephemeral: true,
            }).catch(() => { });
        }
    }

    return true;
}