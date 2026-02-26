export type ChatEmailFrequency = "instant" | "daily" | "off";

type MessageLike = {
  sender?: string;
  read_at?: string | null;
};

export function normalizeChatEmailFrequency(value: unknown): ChatEmailFrequency {
  if (value === "instant" || value === "daily" || value === "off") return value;
  return "daily";
}

export function shouldSendChatEmail(
  frequency: unknown,
  lastSentAt: unknown,
  nowMs: number = Date.now()
): boolean {
  const pref = normalizeChatEmailFrequency(frequency);
  if (pref === "off") return false;
  if (pref === "instant") return true;

  if (!lastSentAt) return true;
  const lastMs = new Date(String(lastSentAt)).getTime();
  if (Number.isNaN(lastMs)) return true;
  return nowMs - lastMs >= 24 * 60 * 60 * 1000;
}

export function countUnreadIncomingMessages<T extends MessageLike>(messages: T[], meId: string): number {
  if (!meId) return 0;
  let count = 0;
  for (const m of messages) {
    if (m.sender !== meId && !m.read_at) count += 1;
  }
  return count;
}

export function conversationPairKey(userA: string, userB: string): string {
  if (!userA || !userB) return "";
  return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}
