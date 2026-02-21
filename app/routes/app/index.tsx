import { A } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";

interface ConnectionRequest {
  id: string;
  from_user: string;
  to_user: string;
  message?: string;
  expand?: {
    from_user?: { id: string; name?: string; area?: string; avatar?: string; bio?: string; breeds_owned_before?: string };
    to_user?: { id: string; name?: string; area?: string; avatar?: string; bio?: string; breeds_owned_before?: string };
  };
}

interface DashboardData {
  user: { avatar?: string; name?: string; phone?: string; area?: string; address_private?: string } | null;
  dogs: { id: string; name?: string; image?: string }[];
  needs: unknown[];
  capacity: unknown[];
}

export default function AppHome() {
  const [connections, { refetch: refetchConnections }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return null;
      try {
        const list = await pb.collection("connection_requests").getFullList<ConnectionRequest>({
          expand: "from_user,to_user",
          requestKey: "app-connections",
        });
        return list;
      } catch {
        return [];
      }
    }
  );

  const [dashboardData] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return null;
      try {
        const [user, dogs, needs, capacity] = await Promise.all([
          pb.collection("users").getOne(userId),
          pb.collection("dogs").getFullList({ filter: `owner = "${userId}"` }),
          pb.collection("watch_needs").getFullList({ filter: `user = "${userId}"` }),
          pb.collection("watch_capacity").getFullList({ filter: `user = "${userId}"` }),
        ]);
        return { user, dogs, needs, capacity } as DashboardData;
      } catch {
        return null;
      }
    }
  );

  const me = () => pb.authStore.model?.id;
  const onboardingComplete = () => pb.authStore.model?.onboarding_complete === true;

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

  const matches = createMemo(() => {
    const conns = connections() ?? [];
    const mutual = mutualUserIds();
    const expanded = new Map<string, { id: string; name?: string; area?: string; avatar?: string; bio?: string; breeds_owned_before?: string }>();
    for (const c of conns) {
      const otherId = c.from_user === me() ? c.to_user : c.to_user === me() ? c.from_user : null;
      if (otherId && mutual.has(otherId)) {
        const expandedUser = c.from_user === me() ? c.expand?.to_user : c.expand?.from_user;
        if (expandedUser && !expanded.has(otherId)) expanded.set(otherId, expandedUser);
      }
    }
    return Array.from(mutual).map((id) => expanded.get(id) ?? { id });
  });

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
      const allDogs = await pb.collection("dogs").getFullList();
      const map = new Map<string, { name?: string; breed?: string }[]>();
      for (const uid of userIds) {
        const userDogs = allDogs.filter((d: { owner: string }) => d.owner === uid);
        map.set(uid, userDogs.map((d: { name?: string; breed?: string }) => ({ name: d.name, breed: d.breed })));
      }
      return map;
    }
  );

  const quickActions = createMemo(() => {
    const data = dashboardData();
    const actions: { href: string; label: string }[] = [];
    if (!data) return actions;

    const { user, dogs, needs, capacity } = data;

    if (!user?.avatar?.trim()) {
      actions.push({ href: "/app/profile", label: "Lägg till profilbild" });
    }
    const profileIncomplete = !user?.name?.trim() || !user?.phone?.trim() || !user?.area?.trim();
    if (profileIncomplete) {
      const missing: string[] = [];
      if (!user?.name?.trim()) missing.push("namn");
      if (!user?.phone?.trim()) missing.push("telefon");
      if (!user?.area?.trim()) missing.push("område");
      actions.push({ href: "/app/profile", label: `Fyll i din profil (${missing.join(", ")})` });
    }
    if (dogs.length === 0) {
      actions.push({ href: "/app/dogs", label: "Lägg till dina hundar" });
    } else {
      const dogsWithoutImage = dogs.filter((d) => !d.image?.trim());
      if (dogsWithoutImage.length > 0) {
        const names = dogsWithoutImage.map((d) => d.name || "Hund").join(", ");
        actions.push({ href: "/app/dogs", label: `Lägg till bild på ${names}` });
      }
    }
    if (needs.length === 0) {
      actions.push({ href: "/app/needs", label: "Lägg till när du behöver hundpassning" });
    }
    if (capacity.length === 0) {
      actions.push({ href: "/app/capacity", label: "Lägg till när du kan passa hundar" });
    }
    actions.push({ href: "/app/matches", label: "Se matchningar" });
    return actions;
  });

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
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

  async function handleUnmatch(otherUserId: string) {
    const conns = (connections() ?? []).filter(
      (c) =>
        (c.from_user === me() && c.to_user === otherUserId) ||
        (c.from_user === otherUserId && c.to_user === me())
    );
    setActionLoading(true);
    try {
      for (const conn of conns) {
        await pb.collection("connection_requests").delete(conn.id);
      }
      refetchConnections();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AppShell>
      <div class="container">
        <div class="page-hero">
          <img src="/logo-icon.png" alt="" width="48" height="48" style="border-radius: 10px; margin-bottom: 0.5rem;" />
          <h1>Översikt</h1>
          <p style="color: var(--color-text-muted);">Välkommen till Hundkrets.</p>
        </div>
        <div class="card">
          <h2>Snabbåtgärder</h2>
          <Show when={dashboardData.loading}>
            <p style="color: var(--color-text-muted);">Laddar...</p>
          </Show>
          <Show when={!dashboardData.loading && quickActions().length > 0}>
            <ul>
              <For each={quickActions()}>
                {(action) => (
                  <li>
                    <A href={action.href}>{action.label}</A>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={!dashboardData.loading && quickActions().length === 0}>
            <p style="color: var(--color-text-muted);">Allt klart! <A href="/app/matches">Se matchningar</A>.</p>
          </Show>
        </div>

        <Show when={onboardingComplete()}>
          <Show when={matches().length > 0}>
            <div class="card">
              <h2>Matchningar</h2>
              <p style="color: var(--color-text-muted); margin-bottom: 1rem;">Ni har kopplat ihop—kontakta varandra via matchningar.</p>
              <ul class="connection-list">
                <For each={matches()}>
                  {(m) => {
                    const dogs = dogsByOwner()?.get(m.id) ?? [];
                    return (
                      <li class="connection-item">
                        <A href={`/app/matches?match=true&user=${m.id}`} class="connection-item-link">
                          <Avatar
                            name={m.name}
                            area={m.area}
                            id={m.id}
                            avatar={m.avatar}
                            baseUrl={baseUrl}
                            class="dog-card-img"
                          />
                          <div style="flex: 1; min-width: 0;">
                            <strong>{m.name || "Okänd"}</strong>
                            {m.area && <span style="color: var(--color-text-muted);"> — {m.area}</span>}
                            {m.bio && <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">{m.bio}</p>}
                            {m.breeds_owned_before && <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-text-muted);">Tidigare raser: {m.breeds_owned_before}</p>}
                            {dogs.length > 0 && <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">Hundar: {dogs.map((d) => d.name || "Hund").join(", ")}</p>}
                            <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-paw);">Klicka för att se på kartan →</p>
                          </div>
                        </A>
                        <div class="connection-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            style="font-size: 0.85rem;"
                            disabled={actionLoading()}
                            onClick={() => handleUnmatch(m.id)}
                          >
                            Avmatcha
                          </button>
                        </div>
                      </li>
                    );
                  }}
                </For>
              </ul>
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
                        <A href={`/app/matches?request=true&user=${req.from_user}`} class="connection-item-link">
                          <Avatar
                            name={from?.name}
                            area={from?.area}
                            id={from?.id}
                            avatar={from?.avatar}
                            baseUrl={baseUrl}
                            class="dog-card-img"
                          />
                          <div style="flex: 1; min-width: 0;">
                            <strong>{from?.name || "Okänd"}</strong>
                            {from?.area && <span style="color: var(--color-text-muted);"> — {from.area}</span>}
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
                        </A>
                        <div class="connection-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            class="btn"
                            style="font-size: 0.85rem;"
                            disabled={actionLoading()}
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
                        <A href={`/app/matches?user=${req.to_user}`} class="connection-item-link">
                          <Avatar
                            name={to?.name}
                            area={to?.area}
                            id={to?.id}
                            avatar={to?.avatar}
                            baseUrl={baseUrl}
                            class="dog-card-img"
                          />
                          <div style="flex: 1; min-width: 0;">
                            <strong>{to?.name || "Okänd"}</strong>
                            {to?.area && <span style="color: var(--color-text-muted);"> — {to.area}</span>}
                            {to?.bio && <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">{to.bio}</p>}
                            {to?.breeds_owned_before && <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-text-muted);">Tidigare raser: {to.breeds_owned_before}</p>}
                            {dogs.length > 0 && <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">Hundar: {dogs.map((d) => d.name || "Hund").join(", ")}</p>}
                            <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">
                              Väntar på svar från {to?.name || "dem"}.
                            </p>
                            <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--color-paw);">Klicka för att se på kartan →</p>
                          </div>
                        </A>
                        <div class="connection-item-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            style="font-size: 0.85rem;"
                            disabled={actionLoading()}
                            onClick={() => handleWithdrawOutgoing(req.id)}
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
        </Show>
      </div>
      <Show when={respondModalTarget()}>
        {(target) => (
          <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="respond-modal-title" onClick={closeRespondModal}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <h2 id="respond-modal-title" style="margin: 0 0 1rem;">Svara på förfrågan</h2>
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
                <button type="button" class="btn btn-secondary" disabled={actionLoading()} onClick={handleRejectRequest}>
                  Avvisa
                </button>
                <button
                  type="button"
                  class="btn"
                  disabled={actionLoading()}
                  onClick={() => handleAcceptWithReply()}
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
