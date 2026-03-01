import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { pb } from "~/lib/pocketbase";
import { subscribeToMessages } from "~/lib/chat-realtime";
import { parseApiError } from "~/lib/errors";
import { showToast } from "~/lib/toast";

type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
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
  updated?: string;
};

function messageTimeMs(m: Message): number {
  // PocketBase setups can differ in which timestamp fields are exposed.
  const ts = m.created ?? m.updated ?? "";
  if (!ts) return 0;
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function formatDateTime(s: string | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ChatThread() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const me = () => (pb.authStore.isValid ? pb.authStore.model?.id ?? "" : "");
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
  const [message, setMessage] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [markingRead, setMarkingRead] = createSignal(false);
  let messagesContainerRef: HTMLDivElement | undefined;
  let composeFormRef: HTMLFormElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;
  let sendInProgress = false;

  function resizeTextarea() {
    const el = textareaRef;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  const [data, { refetch }] = createResource(
    () => [params.id, me(), (searchParams as { with?: string }).with] as const,
    async ([conversationId, meId, withUserId]) => {
      if (!conversationId || !meId) return null;
      let conversation: Conversation;
      try {
        conversation = await pb.collection("conversations").getOne<Conversation>(conversationId, {
          expand: "user_a,user_b",
        });
      } catch (err) {
        console.warn("[chat-thread] conversation getOne failed, trying recovery", err);
        const all = await pb.collection("conversations").getFullList<Conversation>({
          expand: "user_a,user_b",
        });
        const mine = all.filter((c) => c.user_a === meId || c.user_b === meId);
        let recovered: Conversation | undefined;
        if (withUserId) {
          recovered = mine.find((c) =>
            (c.user_a === meId && c.user_b === withUserId) || (c.user_b === meId && c.user_a === withUserId)
          );
        }
        if (!recovered && mine.length === 1) recovered = mine[0];
        if (recovered) {
          if (recovered.id !== conversationId) {
            const qp = withUserId ? `?with=${withUserId}` : "";
            nav(`/app/chats/${recovered.id}${qp}`, { replace: true });
            return null;
          }
          conversation = recovered;
        } else {
          throw err;
        }
      }
      if (conversation.user_a !== meId && conversation.user_b !== meId) {
        throw new Error("Du har inte åtkomst till denna chatt.");
      }

      const otherUserId = conversation.user_a === meId ? conversation.user_b : conversation.user_a;
      const [messages, otherDogs] = await Promise.all([
        pb.collection("messages").getFullList<Message>({
          filter: `conversation = "${conversationId}"`,
        }),
        pb.collection("dogs").getFullList<{ name?: string; breed?: string }>({
          filter: `owner = "${otherUserId}"`,
          fields: "name,breed",
        }),
      ]);
      messages.sort((a, b) => messageTimeMs(a) - messageTimeMs(b));

      const unreadIncoming = messages.filter((m) => m.sender !== meId && !m.read_at);
      if (unreadIncoming.length > 0) {
        setMarkingRead(true);
        try {
          const nowIso = new Date().toISOString();
          for (const m of unreadIncoming) {
            try {
              await pb.collection("messages").update(m.id, { read_at: nowIso });
              m.read_at = nowIso;
            } catch (err) {
              // Don't fail the entire chat view if read receipt update is denied.
              console.warn("[chat-thread] read receipt update failed", err);
            }
          }
        } finally {
          setMarkingRead(false);
        }
      }

      return { conversation, messages, otherDogs };
    }
  );

  async function sendMessage(e: Event) {
    e.preventDefault();
    if (sendInProgress) return;
    const text = message().trim();
    if (!text || !params.id || !me()) return;
    sendInProgress = true;
    setSending(true);
    try {
      pb.autoCancellation(false);
      try {
        await pb.collection("messages").create({
          conversation: params.id,
          sender: me(),
          body: text,
        });
      } finally {
        pb.autoCancellation(true);
      }
      setMessage("");
      await refetch();
    } catch (err: unknown) {
      // PocketBase may occasionally return 400 even when the message was persisted by hooks.
      // Auto-cancelled requests (err.isAbort) can occur if a duplicate request was made.
      // Refetch and treat as success if we can find the just-sent message.
      await refetch();
      const mine = me();
      const justSentExists = (data()?.messages ?? []).some((m) => m.sender === mine && (m.body ?? "").trim() === text);
      if (justSentExists) {
        setMessage("");
        showToast("Meddelandet skickades");
      } else if (err && typeof err === "object" && "isAbort" in err && (err as { isAbort?: boolean }).isAbort) {
        showToast("Försök igen – förra försöket avbröts.", "error");
      } else {
        showToast(parseApiError(err), "error");
      }
    } finally {
      sendInProgress = false;
      setSending(false);
    }
  }

  createEffect(() => {
    const conversationId = params.id;
    if (!conversationId || !me()) return;
    let closed = false;
    let unsubscribe: undefined | (() => void);

    void subscribeToMessages(pb, conversationId, () => void refetch()).then((unsub) => {
      if (closed) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    }).catch((err) => {
      console.warn("[chat-thread] realtime subscribe failed", err);
    });

    onCleanup(() => {
      closed = true;
      unsubscribe?.();
    });
  });

  createEffect(() => {
    const list = data()?.messages;
    if (!list || !messagesContainerRef) return;
    messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
  });

  createEffect(() => {
    message();
    queueMicrotask(resizeTextarea);
  });

  return (
    <AppShell>
      <div class="chat-page">
        <Show when={data.loading && !data()}>
          <p style="color: var(--color-text-muted);">Laddar chatt...</p>
        </Show>
        <Show when={data.error}>
          <div class="card">
            <p style="color: #dc2626; margin: 0 0 1rem;">{data.error?.message}</p>
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" class="btn btn-secondary" onClick={() => nav("/app/chats")}>Till chattar</button>
              <button type="button" class="btn" onClick={() => refetch()}>Försök igen</button>
            </div>
          </div>
        </Show>

        <Show when={data()}>
          {(loaded) => {
            const conversation = () => loaded().conversation;
            const meId = me();
            const isA = conversation().user_a === meId;
            const other = () => (isA ? conversation().expand?.user_b : conversation().expand?.user_a);
            const otherDogs = () => loaded().otherDogs ?? [];
            const dogsSummary = () => {
              const dogs = otherDogs();
              if (dogs.length === 0) return "Vill endast passa";
              return dogs.map((d) => (d.breed ? `${d.name || "Hund"} (${d.breed})` : d.name || "Hund")).join(", ");
            };
            return (
              <>
                <div class="chat-header page-hero" style="align-items: flex-start;">
                  <A href="/app/chats" style="font-size: 0.9rem;">← Tillbaka till chattar</A>
                  <div style="display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem;">
                    <Avatar
                      name={other()?.name}
                      area={other()?.area}
                      id={other()?.id}
                      avatar={other()?.avatar}
                      baseUrl={baseUrl}
                      class="avatar-sm"
                      verified={other()?.verified}
                    />
                    <div>
                      <h1 style="margin: 0;">{other()?.name || "Chatt"}</h1>
                      <p style="margin: 0.2rem 0 0; color: var(--color-text-muted); font-size: 0.9rem;">
                        {[other()?.area, dogsSummary()].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  ref={messagesContainerRef}
                  class="chat-messages card"
                  style="display: flex; flex-direction: column; gap: 0.5rem;"
                >
                  <Show when={loaded().messages.length === 0}>
                    <p style="margin: 0; color: var(--color-text-muted);">Inga meddelanden ännu. Skriv första meddelandet.</p>
                  </Show>
                  <For each={loaded().messages}>
                    {(m) => {
                      const mine = m.sender === meId;
                      return (
                        <div style={`display: flex; ${mine ? "justify-content: flex-end" : "justify-content: flex-start"}`}>
                          <div
                            style={`max-width: 80%; padding: 0.6rem 0.75rem; border-radius: 10px; ${
                              mine ? "background: var(--color-paw); color: #fff;" : "background: var(--color-fur-light); color: var(--color-text);"
                            }`}
                          >
                            <p style="margin: 0; white-space: pre-wrap;">{m.body}</p>
                            <p style={`margin: 0.35rem 0 0; font-size: 0.75rem; ${mine ? "opacity: 0.85;" : "color: var(--color-text-muted);"}`}>
                              {formatDateTime(m.created)}
                              {!mine && m.read_at ? " · läst" : ""}
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>

                <form ref={composeFormRef} class="chat-compose card" onSubmit={sendMessage}>
                  <div class="chat-compose-row">
                    <div class="form-group chat-compose-input-wrap">
                      <label for="chat-message" class="sr-only">Meddelande</label>
                      <textarea
                        ref={textareaRef}
                        id="chat-message"
                        rows={1}
                        maxLength={2000}
                        placeholder="Skriv ett meddelande..."
                        title="Enter skickar, Shift+Enter för ny rad"
                        value={message()}
                        onInput={(e) => {
                          setMessage(e.currentTarget.value);
                          resizeTextarea();
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
                          e.preventDefault();
                          composeFormRef?.requestSubmit();
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      class="chat-send-icon-btn"
                      disabled={sending() || !message().trim()}
                      title={sending() ? "Skickar..." : "Skicka"}
                      aria-label={sending() ? "Skickar..." : "Skicka"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden>
                        <path d="m22 2-7 20-4-9-9-4Z" />
                        <path d="M22 2 11 13" />
                      </svg>
                    </button>
                  </div>
                  <Show when={markingRead()}>
                    <span class="chat-compose-status" role="status">Markerar som läst...</span>
                  </Show>
                </form>
              </>
            );
          }}
        </Show>
      </div>
    </AppShell>
  );
}
