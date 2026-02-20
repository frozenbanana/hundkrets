import { A, useNavigate } from "@solidjs/router";
import { createMemo, createResource, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";
import { getRequestsSeenAt, requestsSeenVersion } from "~/lib/requestsSeen";

export function AppShell(props: { children: import("solid-js").JSX.Element }) {
  const nav = useNavigate();
  const user = () => pb.authStore.model;
  const me = () => pb.authStore.model?.id;

  const [connections] = createResource(
    () => me(),
    async (userId) => {
      if (!userId) return [];
      try {
        return await pb.collection("connection_requests").getFullList({
          expand: "from_user,to_user",
          requestKey: "appshell-connections",
        });
      } catch {
        return [];
      }
    }
  );

  const badgeCount = createMemo(() => {
    requestsSeenVersion();
    const conns = connections() ?? [];
    const myId = me();
    if (!myId) return 0;
    const mutual = new Set<string>();
    for (const c of conns) {
      const other = c.from_user === myId ? c.to_user : c.to_user === myId ? c.from_user : null;
      if (!other) continue;
      const iReq = conns.some((x) => x.from_user === myId && x.to_user === other);
      const theyReq = conns.some((x) => x.from_user === other && x.to_user === myId);
      if (iReq && theyReq) mutual.add(other);
    }
    const incoming = conns.filter((c) => c.to_user === myId && !mutual.has(c.from_user));
    const seenAt = getRequestsSeenAt();
    const unseenIncoming = seenAt
      ? incoming.filter((c) => (c as { created?: string }).created && (c as { created: string }).created > seenAt)
      : incoming;
    return unseenIncoming.length;
  });

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
    }
  });

  function logout() {
    pb.authStore.clear();
    nav("/", { replace: true });
  }

  return (
    <div>
      <nav style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <A href="/app" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem;">
          <img src="/logo-icon.png" alt="" width="28" height="28" style="border-radius: 6px;" />
          Hundkrets
        </A>
        <Avatar
          name={user()?.name}
          city={user()?.city}
          neighborhood={user()?.neighborhood}
          size="sm"
          class="avatar-sm"
        />
        <A href="/app">Översikt</A>
        <A href="/app/profile">Profil</A>
        <A href="/app/dogs">Mina hundar</A>
        <A href="/app/needs">Mina behov</A>
        <A href="/app/capacity">Min kapacitet</A>
        <A href="/app/matches" class="nav-link-with-badge" style="position: relative;">
          Matchningar
          <Show when={badgeCount() > 0}>
            <span class="nav-badge" aria-label={`${badgeCount()} nya`}>{badgeCount()}</span>
          </Show>
        </A>
        <button type="button" class="btn btn-secondary" onClick={logout} style="margin-left: auto;">
          Logga ut
        </button>
      </nav>
      {props.children}
    </div>
  );
}
