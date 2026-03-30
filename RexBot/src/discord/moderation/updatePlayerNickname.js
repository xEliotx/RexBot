export async function updatePlayerNickname(guild, userId, record) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (!guild.members.me?.permissions.has("ManageNicknames")) return;
    if (!member.manageable) return;

    const bans = record.history.filter((x) => x.type === "ban").length;

    const currentBase = member.nickname || member.user.username;
    const cleanedBase = currentBase.replace(/^\[BAN\]\s*/i, "").trim();

    const targetNickname = bans > 0
        ? `[BAN] ${cleanedBase}`.slice(0, 32)
        : null;

    if (member.nickname !== targetNickname) {
        await member.setNickname(targetNickname).catch(() => { });
    }
}