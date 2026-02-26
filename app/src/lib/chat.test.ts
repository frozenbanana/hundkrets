import { describe, it, expect } from "vitest";
import {
  normalizeChatEmailFrequency,
  shouldSendChatEmail,
  countUnreadIncomingMessages,
  conversationPairKey,
} from "~/lib/chat";

describe("normalizeChatEmailFrequency", () => {
  it("keeps valid values", () => {
    expect(normalizeChatEmailFrequency("instant")).toBe("instant");
    expect(normalizeChatEmailFrequency("daily")).toBe("daily");
    expect(normalizeChatEmailFrequency("off")).toBe("off");
  });

  it("defaults to daily for invalid values", () => {
    expect(normalizeChatEmailFrequency(undefined)).toBe("daily");
    expect(normalizeChatEmailFrequency("weekly")).toBe("daily");
    expect(normalizeChatEmailFrequency(null)).toBe("daily");
  });
});

describe("shouldSendChatEmail", () => {
  const now = new Date("2026-01-10T12:00:00.000Z").getTime();

  it("sends immediately for instant", () => {
    expect(shouldSendChatEmail("instant", "2026-01-10T11:59:00.000Z", now)).toBe(true);
  });

  it("never sends for off", () => {
    expect(shouldSendChatEmail("off", null, now)).toBe(false);
  });

  it("sends for daily when never sent before", () => {
    expect(shouldSendChatEmail("daily", null, now)).toBe(true);
  });

  it("does not send daily within 24h", () => {
    expect(shouldSendChatEmail("daily", "2026-01-10T00:00:01.000Z", now)).toBe(false);
  });

  it("sends daily after 24h", () => {
    expect(shouldSendChatEmail("daily", "2026-01-09T11:59:59.000Z", now)).toBe(true);
  });
});

describe("countUnreadIncomingMessages", () => {
  it("counts only incoming unread messages", () => {
    const me = "u1";
    const messages = [
      { sender: "u2", read_at: null },
      { sender: "u2", read_at: undefined },
      { sender: "u2", read_at: "2026-01-01T00:00:00.000Z" },
      { sender: "u1", read_at: null },
    ];
    expect(countUnreadIncomingMessages(messages, me)).toBe(2);
  });
});

describe("conversationPairKey", () => {
  it("is stable regardless of input order", () => {
    expect(conversationPairKey("a", "b")).toBe("a:b");
    expect(conversationPairKey("b", "a")).toBe("a:b");
  });

  it("returns empty key for missing values", () => {
    expect(conversationPairKey("", "a")).toBe("");
    expect(conversationPairKey("a", "")).toBe("");
  });
});
