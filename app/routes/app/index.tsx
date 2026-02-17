import { A } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";

interface ConnectionRequest {
  id: string;
  from_user: string;
  to_user: string;
  expand?: {
    from_user?: { id: string; name?: string; area?: string; avatar?: string };
    to_user?: { id: string; name?: string; area?: string; avatar?: string };
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
    const expanded = new Map<string, { id: string; name?: string; area?: string; avatar?: string }>();
    for (const c of conns) {
      const otherId = c.from_user === me() ? c.to_user : c.to_user === me() ? c.from_user : null;
      if (otherId && mutual.has(otherId)) {
        const expandedUser = c.from_user === me() ? c.expand?.to_user : c.expand?.from_user;
        if (expandedUser && !expanded.has(otherId)) expanded.set(otherId, expandedUser);
      }
    }
    return Array.from(mutual).map((id) => expanded.get(id) ?? { id });
  });

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
      actions.push({ href: "/app/needs/new", label: "Lägg till när du behöver hundpassning" });
    }
    if (capacity.length === 0) {
      actions.push({ href: "/app/capacity/new", label: "Lägg till när du kan passa hundar" });
    }
    actions.push({ href: "/app/matches", label: "Se matchningar" });
    return actions;
  });

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
  const [actionLoading, setActionLoading] = createSignal(false);

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
                  {(m) => (
                    <li class="connection-item">
                      <Avatar
                        name={m.name}
                        area={m.area}
                        id={m.id}
                        avatar={m.avatar}
                        baseUrl={baseUrl}
                        class="dog-card-img"
                      />
                      <div style="flex: 1;">
                        <strong>{m.name || "Okänd"}</strong>
                        {m.area && <span style="color: var(--color-text-muted);"> — {m.area}</span>}
                        <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">
                          <A href="/app/matches?match=true">Visa i matchningar</A> för telefon och adress.
                        </p>
                        <button
                          type="button"
                          class="btn btn-secondary"
                          style="margin-top: 0.5rem; font-size: 0.85rem;"
                          disabled={actionLoading()}
                          onClick={() => handleUnmatch(m.id)}
                        >
                          Avmatcha
                        </button>
                      </div>
                    </li>
                  )}
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
                    return (
                      <li class="connection-item">
                        <Avatar
                          name={from?.name}
                          area={from?.area}
                          id={from?.id}
                          avatar={from?.avatar}
                          baseUrl={baseUrl}
                          class="dog-card-img"
                        />
                        <div style="flex: 1;">
                          <strong>{from?.name || "Okänd"}</strong>
                          {from?.area && <span style="color: var(--color-text-muted);"> — {from.area}</span>}
                          <p style="margin: 0.25rem 0 0; font-size: 0.9rem;">
                            <A href="/app/matches">Visa i matchningar</A> och klicka "Jag är intresserad" för att koppla ihop.
                          </p>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            style="margin-top: 0.5rem; font-size: 0.85rem;"
                            disabled={actionLoading()}
                            onClick={() => handleRejectIncoming(req.id)}
                          >
                            Avvisa
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
                    return (
                      <li class="connection-item">
                        <Avatar
                          name={to?.name}
                          area={to?.area}
                          id={to?.id}
                          avatar={to?.avatar}
                          baseUrl={baseUrl}
                          class="dog-card-img"
                        />
                        <div style="flex: 1;">
                          <strong>{to?.name || "Okänd"}</strong>
                          {to?.area && <span style="color: var(--color-text-muted);"> — {to.area}</span>}
                          <p style="margin: 0.25rem 0 0; font-size: 0.9rem; color: var(--color-text-muted);">
                            Väntar på svar från {to?.name || "dem"}.
                          </p>
                          <button
                            type="button"
                            class="btn btn-secondary"
                            style="margin-top: 0.5rem; font-size: 0.85rem;"
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
    </AppShell>
  );
}
