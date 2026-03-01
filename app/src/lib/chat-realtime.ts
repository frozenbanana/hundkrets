import type PocketBase from "pocketbase";

type MessageRecord = {
  conversation?: string;
  [key: string]: unknown;
};

/**
 * Subscribes to realtime message events for a conversation.
 * Calls onUpdate when a message event occurs for the given conversation.
 * Returns a Promise that resolves to an unsubscribe function.
 */
export async function subscribeToMessages(
  pb: PocketBase,
  conversationId: string,
  onUpdate: () => void
): Promise<() => void> {
  const unsub = await pb.collection("messages").subscribe(
    "*",
    (evt) => {
      const record = evt.record as MessageRecord | undefined;
      if (!record || record.conversation !== conversationId) return;
      onUpdate();
    }
  );
  return unsub;
}
