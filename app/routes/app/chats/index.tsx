import { A } from "@solidjs/router";
import { createEffect, createMemo, createResource, For, onCleanup, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { pb } from "~/lib/pocketbase";
import { countUnreadIncomingMessages } from "~/lib/chat";

type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at?: string;
  updated?: string;
  expand?: {
    user_a?: { id: string; name?: string; area?: string; avatar?: string; verified?: boolean };
    user_b?: { id: string; name?: string; area?: string; avatar?: string; verified?: boolean };
  };
};

type Message = {
  id: string;
  conversation: string;
  sender: string;
  body?: string;
  read_at?: string;
  created?: string;
};

function formatDateTime(s: string | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Chats() {
  const me = () => (pb.authStore.isValid ? pb.authStore.model?.id ?? "" : "");
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  const [data, { refetch }] = createResource(
    () => me(),
    async (meId) => {
      if (!meId) return { conversations: [] as Conversation[], unreadByConversation: new Map<string, number>() };

      let conversations: Conversation[] = [];
      try {
        conversations = await pb.collection("conversations").getFullList<Conversation>({
          expand: "user_a,user_b",
        });
      } catch (err) {
        console.warn("[chats] fallback query after conversations fetch error", err);
        conversations = await pb.collection("conversations").getFullList<Conversation>({
        });
      }
      const messages = await pb.collection("messages").getFullList<Message>({
      });
      conversations = [...conversations].sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });

      const unreadByConversation = new Map<string, number>();
      const grouped = new Map<string, Message[]>();
      for (const m of messages) {
        if (!grouped.has(m.conversation)) grouped.set(m.conversation, []);
        grouped.get(m.conversation)!.push(m);
      }
      for (const [conversationId, items] of grouped.entries()) {
        unreadByConversation.set(conversationId, countUnreadIncomingMessages(items, meId));
      }
      return { conversations, unreadByConversation };
    }
  );

  const items = createMemo(() => data()?.conversations ?? []);

  createEffect(() => {
    const meId = me();
    if (!meId) return;
    let closed = false;
    let unsubscribeConversations: undefined | (() => void);
    let unsubscribeMessages: undefined | (() => void);

    void (async () => {
      try {
        const [unsubConv, unsubMsg] = await Promise.all([
          pb.collection("conversations").subscribe("*", () => void refetch(), {
            filter: `user_a = "${meId}" || user_b = "${meId}"`,
          }),
          pb.collection("messages").subscribe("*", (evt) => {
            const record = evt.record as unknown as Message | undefined;
            if (!record) return;
            const hasConversation = (data()?.conversations ?? []).some((c) => c.id === record.conversation);
            if (hasConversation) void refetch();
          }),
        ]);
        if (closed) {
          unsubConv();
          unsubMsg();
          return;
        }
        unsubscribeConversations = unsubConv;
        unsubscribeMessages = unsubMsg;
      } catch (err) {
        console.warn("[chats] realtime subscribe failed", err);
      }
    })();

    onCleanup(() => {
      closed = true;
      unsubscribeConversations?.();
      unsubscribeMessages?.();
    });
  });

  return (
    <AppShell>
      <div class="container">
        <div class="page-hero">
          <span class="paw-emoji">💬</span>
          <h1>Chattar</h1>
          <p style="color: var(--color-text-muted);">Skriv med personer du har matchat med.</p>
        </div>

        <Show when={data.loading}>
          <p style="color: var(--color-text-muted);">Laddar chattar...</p>
        </Show>
        <Show when={data.error}>
          <p style="color: #dc2626;">Kunde inte ladda chattar: {data.error?.message}</p>
          <button type="button" class="btn" onClick={() => refetch()}>Försök igen</button>
        </Show>

        <Show when={!data.loading && items().length === 0}>
          <div class="card">
            <p style="margin: 0; color: var(--color-text-muted);">
              Inga chattar ännu. Gå till matchningar och öppna en chatt med en matchad användare.
            </p>
            <A href="/app/explore?match=true" class="btn" style="margin-top: 1rem;">Till Utforska</A>
          </div>
        </Show>

        <Show when={items().length > 0}>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <For each={items()}>
              {(conv) => {
                const meId = me();
                const isA = conv.user_a === meId;
                const other = isA ? conv.expand?.user_b : conv.expand?.user_a;
                const unread = data()?.unreadByConversation.get(conv.id) ?? 0;
                const chatUrl = `/app/chats/${conv.id}?with=${other?.id ?? ""}`;
                const profileUrl = other?.id ? `/users/${other.id}?from=chat&chat=${conv.id}` : chatUrl;
                const timeStr = formatDateTime(conv.last_message_at);
                return (
                  <div class="card chat-list-card">
                    <A
                      href={profileUrl}
                      class="chat-list-avatar-link"
                      aria-label={`Visa ${other?.name || "användaren"}s profil`}
                    >
                      <Avatar
                        name={other?.name}
                        area={other?.area}
                        id={other?.id}
                        avatar={other?.avatar}
                        baseUrl={baseUrl}
                        class="avatar-sm"
                        verified={other?.verified}
                      />
                    </A>
                    <A href={chatUrl} class="chat-list-chat-link" aria-label="Öppna chatt">
                      <div class="chat-list-content">
                        <div class="chat-list-content-header">
                          <strong>{other?.name || "Okänd användare"}</strong>
                          <Show when={timeStr}>
                            <span class="chat-list-time">{timeStr}</span>
                          </Show>
                        </div>
                        <p class="chat-list-area">{other?.area || "Öppna chatt"}</p>
                      </div>
                      <span class="chat-list-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                    </A>
                    <Show when={unread > 0}>
                      <span class="nav-badge" aria-label={`${unread} olästa`}>{unread}</span>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </AppShell>
  );
}
