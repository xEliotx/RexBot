import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
} from "discord.js";

const CARNIVORE_OPTIONS = [
    { label: "Allosaurus", value: "allo", description: "Toggle the Allosaurus ping role" },
    { label: "Carnotaurus", value: "carno", description: "Toggle the Carnotaurus ping role" },
    { label: "Ceratosaurus", value: "cerato", description: "Toggle the Ceratosaurus ping role" },
    { label: "Deinosuchus", value: "deino", description: "Toggle the Deinosuchus ping role" },
    { label: "Dilophosaurus", value: "dilo", description: "Toggle the Dilophosaurus ping role" },
    { label: "Herrerasaurus", value: "herrera", description: "Toggle the Herrerasaurus ping role" },
    { label: "Omniraptor", value: "omni", description: "Toggle the Omniraptor ping role" },
    { label: "Troodon", value: "troodon", description: "Toggle the Troodon ping role" },
    { label: "Tyrannosaurus", value: "rex", description: "Toggle the Tyrannosaurus ping role" },
    { label: "Pteranodon", value: "ptera", description: "Toggle the Pteranodon ping role" },
];

const HERBIVORE_OPTIONS = [
    { label: "Diabloceratops", value: "diablo", description: "Toggle the Diabloceratops ping role" },
    { label: "Dryosaurus", value: "dryo", description: "Toggle the Dryosaurus ping role" },
    { label: "Hypsilophodon", value: "hypsi", description: "Toggle the Hypsilophodon ping role" },
    { label: "Maiasaura", value: "maia", description: "Toggle the Maiasaura ping role" },
    { label: "Pachycephalosaurus", value: "pachy", description: "Toggle the Pachycephalosaurus ping role" },
    { label: "Stegosaurus", value: "stego", description: "Toggle the Stegosaurus ping role" },
    { label: "Tenontosaurus", value: "teno", description: "Toggle the Tenontosaurus ping role" },
    { label: "Triceratops", value: "trike", description: "Toggle the Triceratops ping role" },
];

const OMNIVORE_OPTIONS = [
    { label: "Beipiaosaurus", value: "beipiao", description: "Toggle the Beipiaosaurus ping role" },
    { label: "Gallimimus", value: "galli", description: "Toggle the Gallimimus ping role" },
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

export function buildDinoRolesMessage(guild) {
    const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
            name: guild?.name ?? "Role Selection",
            iconURL: guild?.iconURL?.() ?? undefined,
        })
        .setTitle("Dinosaur Roles")
        .setDescription(
            "Select a dinosaur below to toggle its ping role.\n\nIf you already have that role, selecting it again will remove it."
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

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(carnivoreMenu),
            new ActionRowBuilder().addComponents(herbivoreMenu),
            new ActionRowBuilder().addComponents(omnivoreMenu),
        ],
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

        if (hasRole) {
            await member.roles.remove(roleId);
            await interaction.reply({
                content: `❌ Removed ${role ? role.name : "role"}.`,
                ephemeral: true,
            });
        } else {
            await member.roles.add(roleId);
            await interaction.reply({
                content: `✅ Added ${role ? role.name : "role"}.`,
                ephemeral: true,
            });
        }
    } catch (err) {
        ctx.logger?.error?.("Failed to toggle dino role:", err);
        await interaction.reply({
            content: "I couldn't update your role. Check my permissions and role order.",
            ephemeral: true,
        });
    }

    return true;
}