import { A, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { RecommendedMembersSection } from "~/components/RecommendedMembersSection";
import { pb } from "~/lib/pocketbase";
import { countUnreadIncomingMessages, conversationPairKey } from "~/lib/chat";
import { isUserVerified } from "~/lib/auth";
import { showToast } from "~/lib/toast";

interface ConnectionRequest {
  id: string;
  from_user: string;
  to_user: string;
  message?: string;
  expand?: {
    from_user?: { id: string; name?: string; area?: string; avatar?: string; bio?: string; breeds_owned_before?: string; verified?: boolean };
    to_user?: { id: string; name?: string; area?: string; avatar?: string; bio?: string; breeds_owned_before?: string; verified?: boolean };
  };
}

type ConversationPb = {
  id: string;
  user_a: string;
  user_b: string;
};

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
  const navigate = useNavigate();
  const me = () => (pb.authStore.isValid ? pb.authStore.model?.id ?? "" : "");
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  const [connections, { refetch: refetchConnections }] = createResource(
    () => me(),
    async (userId) => {
      if (!userId) return [];
      try {
        return await pb.collection("connection_requests").getFullList<ConnectionRequest>({
          expand: "from_user,to_user",
          requestKey: "chats-connections",
        });
      } catch {
        return [];
      }
    }
  );

  const mutualUserIds = createMemo(() => {
    const conns = connections() ?? [];
    const myId = me();
    if (!myId) return new Set<string>();
    const set = new Set<string>();
    for (const c of conns) {
      const other = c.from_user === myId ? c.to_user : c.to_user === myId ? c.from_user : null;
      if (!other) continue;
      const iRequested = conns.some((x) => x.from_user === myId && x.to_user === other);
      const theyRequested = conns.some((x) => x.from_user === other && x.to_user === myId);
      if (iRequested && theyRequested) set.add(other);
    }
    return set;
  });

  const incoming = () => {
    const conns = connections() ?? [];
    const mutual = mutualUserIds();
    return conns.filter((c) => c.to_user === me() && !mutual.has(c.from_user));
  };

  const outgoing = () => {
    const conns = connections() ?? [];
    const mutual = mutualUserIds();
    return conns.filter((c) => c.from_user === me() && !mutual.has(c.to_user));
  };

  const [dogsByOwner] = createResource(
    () => {
      const conns = connections() ?? [];
      const ids = new Set<string>();
      for (const c of conns) {
        if (c.from_user !== me()) ids.add(c.from_user);
        if (c.to_user !== me()) ids.add(c.to_user);
      }
      return Array.from(ids);
    },
    async (userIds) => {
      if (userIds.length === 0) return new Map<string, { name?: string; breed?: string }[]>();
      const allDogs = await pb.collection("dogs").getFullList<{ owner: string; name?: string; breed?: string }>();
      const map = new Map<string, { name?: string; breed?: string }[]>();
      for (const uid of userIds) {
        const userDogs = allDogs.filter((d) => d.owner === uid);
        map.set(uid, userDogs.map((d) => ({ name: d.name, breed: d.breed })));
      }
      return map;
    }
  );

  const [actionLoading, setActionLoading] = createSignal(false);
  const [respondModalTarget, setRespondModalTarget] = createSignal<{
    requestId: string;
    fromUserId: string;
    fromUserName?: string;
  } | undefined>();
  const [respondModalMessage, setRespondModalMessage] = createSignal("");

  function openRespondModal(req: ConnectionRequest) {
    setRespondModalTarget({
      requestId: req.id,
      fromUserId: req.from_user,
      fromUserName: req.expand?.from_user?.name,
    });
    setRespondModalMessage("");
  }

  function closeRespondModal() {
    setRespondModalTarget(undefined);
    setRespondModalMessage("");
  }

  async function handleAcceptWithReply() {
    const target = respondModalTarget();
    if (!target) return;
    setActionLoading(true);
    try {
      await pb.collection("connection_requests").create({
        from_user: me()!,
        to_user: target.fromUserId,
        ...(respondModalMessage().trim() && { message: respondModalMessage().trim() }),
      });
      closeRespondModal();
      refetchConnections();
      showToast("Matchad! Ni kan nu kontakta varandra.");
    } catch (err) {
      console.error("Accept failed:", err);
      refetchConnections();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectRequest() {
    const target = respondModalTarget();
    if (!target) return;
    setActionLoading(true);
    try {
      await pb.collection("connection_requests").delete(target.requestId);
      closeRespondModal();
      refetchConnections();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectIncoming(connId: string) {
    setActionLoading(true);
    try {
      await pb.collection("connection_requests").delete(connId);
      refetchConnections();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleWithdrawOutgoing(connId: string) {
    setActionLoading(true);
    try {
      await pb.collection("connection_requests").delete(connId);
      refetchConnections();
    } finally {
      setActionLoading(false);
    }
  }

  async function ensureConversation(otherUserId: string): Promise<string> {
    const myId = me();
    if (!myId) throw new Error("Inte inloggad");

    const existing = await (async () => {
      const conversations = await pb.collection("conversations").getFullList<ConversationPb>({});
      const matchSet = new Set([otherUserId]);
      for (const c of conversations) {
        const other = c.user_a === myId ? c.user_b : c.user_b === myId ? c.user_a : "";
        if (other && matchSet.has(other)) return c.id;
      }
      return null;
    })();
    if (existing) return existing;

    const key = conversationPairKey(myId, otherUserId);
    try {
      const byKey = await pb.collection("conversations").getFirstListItem<ConversationPb>(`pair_key = "${key}"`);
      return byKey.id;
    } catch {}

    try {
      const byUsers = await pb.collection("conversations").getFirstListItem<ConversationPb>(
        `(user_a = "${myId}" && user_b = "${otherUserId}") || (user_a = "${otherUserId}" && user_b = "${myId}")`
      );
      return byUsers.id;
    } catch {}

    const userA = myId < otherUserId ? myId : otherUserId;
    const userB = myId < otherUserId ? otherUserId : myId;
    const created = await pb.collection("conversations").create({
      user_a: userA,
      user_b: userB,
      pair_key: key,
    });
    return created.id;
  }

  async function handleOpenChat(otherUserId: string) {
    try {
      const conversationId = await ensureConversation(otherUserId);
      navigate(`/app/chats/${conversationId}?with=${otherUserId}`);
    } catch (err) {
      console.error("[chats] handleOpenChat error", err);
      showToast("Kunde inte öppna chatt just nu.", "error");
    }
  }

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
    let unsubConv: (() => void) | undefined;
    let unsubMsg: (() => void) | undefined;
    let unsubConn: (() => void) | undefined;

    void Promise.all([
      pb.collection("conversations").subscribe("*", () => void refetch(), {
        filter: `user_a = "${meId}" || user_b = "${meId}"`,
      }),
      pb.collection("messages").subscribe("*", (evt) => {
        const record = evt.record as unknown as Message | undefined;
        if (!record) return;
        const hasConversation = (data()?.conversations ?? []).some((c) => c.id === record.conversation);
        if (hasConversation) void refetch();
      }),
      pb.collection("connection_requests").subscribe("*", () => void refetchConnections()),
    ]).then(([a, b, c]) => {
      if (closed) {
        a();
        b();
        c();
        return;
      }
      unsubConv = a;
      unsubMsg = b;
      unsubConn = c;
    }).catch((err) => {
      console.warn("[chats] realtime subscribe failed", err);
    });

    onCleanup(() => {
      closed = true;
      unsubConv?.();
      unsubMsg?.();
      unsubConn?.();
    });
  });

  return (
    <AppShell>
      <div class="container">
        <div class="page-hero">
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

        <div class="card">
          <h2>Rekommenderade medlemmar</h2>
          <RecommendedMembersSection profileFrom="chats" showNeedsCapacityHint showFooterActions={false} />
        </div>

        <Show when={!data.loading && items().length === 0}>
          <div class="card">
            <p style="margin: 0; color: var(--color-text-muted);">
              Inga chattar ännu. Gå till matchningar och öppna en chatt med en matchad användare.
            </p>
            <A href="/app/explore?match=true" class="btn" style="margin-top: 1rem;">Till Utforska</A>
          </div>
        </Show>

        <div class="card">
          <h2>Inkommande förfrågningar</h2>
          <Show when={connections.loading}>
            <p style="color: var(--color-text-muted);">Laddar...</p>
          </Show>
          <Show when={!connections.loading && incoming().length === 0}>
            <p style="color: var(--color-text-muted);">Inga inkommande förfrågningar.</p>
          </Show>
          <Show when={!connections.loading && incoming().length > 0}>
            <ul class="connection-list">
              <For each={incoming()}>
                {(req) => {
                  const from = req.expand?.from_user;
                  const dogs = dogsByOwner()?.get(req.from_user) ?? [];
                  return (
                    <li class="connection-item">
                      <A href={`/app/explore?request=true&user=${req.from_user}`} class="connection-item-link">
                        <Avatar
                          name={from?.name}
                          area={from?.area}
                          id={from?.id}
                          avatar={from?.avatar}
                          baseUrl={baseUrl}
                          class="dog-card-img"
                          verified={from?.verified}
                        />
                        <div class="connection-item-content">
                          <div class="connection-item-header">
                            <strong>{from?.name || "Okänd"}</strong>
                            {from?.area && <span style="color: var(--color-text-muted);"> — {from.area}</span>}
                          </div>
                          <div class="connection-item-body" style="flex: 1; min-width: 0;">
                            {from?.bio && <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">{from.bio}</p>}
                            {from?.breeds_owned_before && <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-text-muted);">Tidigare raser: {from.breeds_owned_before}</p>}
                            {dogs.length > 0 && <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">Hundar: {dogs.map((d) => d.name || "Hund").join(", ")}</p>}
                            {req.message && (
                              <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--color-fur-light); border-radius: var(--radius-dog); border-left: 4px solid var(--color-paw);">
                                <p style="margin: 0; font-size: 0.9rem; color: var(--color-text); font-style: italic;">"{req.message}"</p>
                              </div>
                            )}
                            <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-paw);">Vill koppla ihop — klicka för att se på kartan →</p>
                          </div>
                        </div>
                      </A>
                      <div class="connection-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          class="btn"
                          style="font-size: 0.85rem;"
                          disabled={actionLoading() || !isUserVerified()}
                          title={!isUserVerified() ? "Verifiera din e-post för att svara på förfrågningar." : undefined}
                          onClick={() => openRespondModal(req)}
                        >
                          Svara
                        </button>
                      </div>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </div>

        <div class="card">
          <h2>Utgående förfrågningar</h2>
          <Show when={connections.loading}>
            <p style="color: var(--color-text-muted);">Laddar...</p>
          </Show>
          <Show when={!connections.loading && outgoing().length === 0}>
            <p style="color: var(--color-text-muted);">Inga utgående förfrågningar.</p>
          </Show>
          <Show when={!connections.loading && outgoing().length > 0}>
            <ul class="connection-list">
              <For each={outgoing()}>
                {(req) => {
                  const to = req.expand?.to_user;
                  const dogs = dogsByOwner()?.get(req.to_user) ?? [];
                  return (
                    <li class="connection-item">
                      <A href={`/app/explore?user=${req.to_user}`} class="connection-item-link">
                        <Avatar
                          name={to?.name}
                          area={to?.area}
                          id={to?.id}
                          avatar={to?.avatar}
                          baseUrl={baseUrl}
                          class="dog-card-img"
                          verified={to?.verified}
                        />
                        <div class="connection-item-content">
                          <div class="connection-item-header">
                            <strong>{to?.name || "Okänd"}</strong>
                            {to?.area && <span style="color: var(--color-text-muted);"> — {to.area}</span>}
                          </div>
                          <div class="connection-item-body" style="flex: 1; min-width: 0;">
                            {to?.bio && <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">{to.bio}</p>}
                            {to?.breeds_owned_before && <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-text-muted);">Tidigare raser: {to.breeds_owned_before}</p>}
                            {dogs.length > 0 && <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">Hundar: {dogs.map((d) => d.name || "Hund").join(", ")}</p>}
                            <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">
                              Väntar på svar från {to?.name || "dem"}.
                            </p>
                            <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-paw);">Klicka för att se på kartan →</p>
                          </div>
                        </div>
                      </A>
                      <div class="connection-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          class="btn btn-secondary"
                          style="font-size: 0.85rem;"
                          disabled={actionLoading()}
                          onClick={() => handleWithdrawOutgoing(req.id)} data-umami-event="Withdraw interest"
                        >
                          Ångra
                        </button>
                      </div>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </div>
      </div>
      <Show when={respondModalTarget()}>
        {(target) => (
          <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="respond-modal-title" onClick={closeRespondModal}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h2 id="respond-modal-title" style="margin: 0;">Svara på förfrågan</h2>
                <button type="button" class="match-detail-close" onClick={closeRespondModal} aria-label="Stäng">×</button>
              </div>
              <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
                {target().fromUserName ? `Skriv ett svar till ${target().fromUserName} (valfritt):` : "Skriv ett svar (valfritt):"}
              </p>
              <div class="form-group">
                <label for="respond-message">Meddelande</label>
                <textarea
                  id="respond-message"
                  placeholder="T.ex. Hej! Jag är också intresserad av att byta hundpassning..."
                  value={respondModalMessage()}
                  onInput={(e) => setRespondModalMessage(e.currentTarget.value)}
                  rows={4}
                  maxLength={500}
                  style="resize: vertical;"
                />
              </div>
              <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
                <button type="button" class="btn btn-secondary" disabled={actionLoading()} onClick={handleRejectRequest} data-umami-event="Reject request">
                  Avvisa
                </button>
                <button
                  type="button"
                  class="btn"
                  disabled={actionLoading() || !isUserVerified()}
                  title={!isUserVerified() ? "Verifiera din e-post för att svara på förfrågningar." : undefined}
                  onClick={() => handleAcceptWithReply()}
                  data-umami-event="Accept match"
                >
                  Acceptera
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </AppShell>
  );
}
