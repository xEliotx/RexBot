export function ensurePlayerRecord(data, user) {
    if (!data[user.id]) {
        data[user.id] = {
            discordId: user.id,
            history: [],
            recordMessageId: null,
        };
    }

    return data[user.id];
}

export function addHistoryEntry(record, type, reason, staffId) {
    record.history.push({
        id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        reason,
        staffId,
        date: new Date().toISOString(),
    });
}

export function getTypeCount(record, type) {
    return record.history.filter((x) => x.type === type).length;
}

export function cleanEntries(record, type, amount) {
    if (type === "all") {
        const removed = record.history.length;
        record.history = [];
        return removed;
    }

    const matching = record.history.filter((x) => x.type === type);
    if (!matching.length) return 0;

    if (amount === "all") {
        const removed = matching.length;
        record.history = record.history.filter((x) => x.type !== type);
        return removed;
    }

    let remainingToRemove = Number(amount);
    if (!Number.isFinite(remainingToRemove) || remainingToRemove <= 0) return 0;

    const next = [];
    for (let i = record.history.length - 1; i >= 0; i--) {
        const entry = record.history[i];
        if (entry.type === type && remainingToRemove > 0) {
            remainingToRemove--;
            continue;
        }
        next.push(entry);
    }

    record.history = next.reverse();
    return Number(amount) - remainingToRemove;
}