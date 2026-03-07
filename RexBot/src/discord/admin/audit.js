export async function auditLog(client, channels, message) {
  const targetId = channels.auditChannelId || channels.adminChannelId;
  if (!targetId) return;

  try {
    const ch = await client.channels.fetch(targetId);
    if (!ch || !("send" in ch)) return;
    await ch.send({ content: message });
  } catch {
    // ignore
  }
}
