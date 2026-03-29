export function parseTicketTopic(topic = "") {
    const ownerId = topic.match(/ticket_owner=(\d+)/)?.[1] ?? null;
    const ticketNum = topic.match(/ticket_num=(\d+)/)?.[1] ?? null;
    const ticketType = topic.match(/ticket_type=([^;]+)/)?.[1] ?? null;
    const lastActivityMs = Number(topic.match(/last_activity=(\d+)/)?.[1] ?? 0);
    const warned = (topic.match(/warned=(\d+)/)?.[1] ?? "0") === "1";
    const claimedBy = topic.match(/claimed_by=(\d+)/)?.[1] ?? null;
    const ticketMessageId = topic.match(/ticket_message=(\d+)/)?.[1] ?? null;

    return { ownerId, ticketNum, ticketType, lastActivityMs, warned, claimedBy, ticketMessageId };
}

export function setTopicValue(topic = "", key, value) {
    const safeValue = String(value).replace(/;/g, "_");

    if (topic.includes(`${key}=`)) {
        return topic.replace(new RegExp(`${key}=[^;]*`), `${key}=${safeValue}`);
    }

    return topic ? `${topic};${key}=${safeValue}` : `${key}=${safeValue}`;
}

export function removeTopicValue(topic = "", key) {
    return topic
        .replace(new RegExp(`(?:^|;)${key}=[^;]*`), "")
        .replace(/^;/, "")
        .replace(/;;+/g, ";");
}

export function updateTicketActivityTopic(topic = "", timestamp = Date.now()) {
    let next = setTopicValue(topic, "last_activity", timestamp);
    next = setTopicValue(next, "warned", 0);
    return next;
}