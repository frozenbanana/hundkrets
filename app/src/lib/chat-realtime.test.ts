import { describe, it, expect, vi, beforeEach } from "vitest";
import { subscribeToMessages } from "~/lib/chat-realtime";

describe("subscribeToMessages", () => {
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockPb: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockPb = {
      collection: vi.fn().mockReturnValue({
        subscribe: mockSubscribe,
      }),
    };
  });

  it("calls onUpdate when a message event matches the conversation", async () => {
    const onUpdate = vi.fn();
    let eventCallback: ((evt: { record: { conversation: string } }) => void) | null = null;

    mockSubscribe.mockImplementation((_filter: string, cb: (evt: { record: { conversation: string } }) => void) => {
      eventCallback = cb;
      return Promise.resolve(() => {});
    });

    const unsub = await subscribeToMessages(mockPb as never, "conv-123", onUpdate);

    expect(mockPb.collection).toHaveBeenCalledWith("messages");
    expect(mockSubscribe).toHaveBeenCalledWith("*", expect.any(Function));
    expect(onUpdate).not.toHaveBeenCalled();

    eventCallback!({ record: { conversation: "conv-123" } });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    eventCallback!({ record: { conversation: "conv-123", body: "Hej!" } });
    expect(onUpdate).toHaveBeenCalledTimes(2);

    unsub();
  });

  it("does not call onUpdate when message belongs to another conversation", async () => {
    const onUpdate = vi.fn();
    let eventCallback: ((evt: { record: { conversation: string } }) => void) | null = null;

    mockSubscribe.mockImplementation((_filter: string, cb: (evt: { record: { conversation: string } }) => void) => {
      eventCallback = cb;
      return Promise.resolve(() => {});
    });

    await subscribeToMessages(mockPb as never, "conv-123", onUpdate);

    eventCallback!({ record: { conversation: "conv-other" } });
    eventCallback!({ record: { conversation: "conv-456" } });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("does not call onUpdate when record is missing or has no conversation", async () => {
    const onUpdate = vi.fn();
    let eventCallback: ((evt: { record?: unknown }) => void) | null = null;

    mockSubscribe.mockImplementation((_filter: string, cb: (evt: { record?: unknown }) => void) => {
      eventCallback = cb;
      return Promise.resolve(() => {});
    });

    await subscribeToMessages(mockPb as never, "conv-123", onUpdate);

    eventCallback!({});
    eventCallback!({ record: null });
    eventCallback!({ record: undefined });
    eventCallback!({ record: {} });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function", async () => {
    const mockUnsub = vi.fn();
    mockSubscribe.mockResolvedValue(mockUnsub);

    const unsub = await subscribeToMessages(mockPb as never, "conv-123", () => {});

    expect(unsub).toBe(mockUnsub);
    unsub();
    expect(mockUnsub).toHaveBeenCalled();
  });
});
