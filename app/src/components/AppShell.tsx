import { A, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { authVersion } from "~/lib/authStore";
import { Avatar } from "~/components/Avatar";
import { AdminMessageBanner } from "~/components/AdminMessageBanner";
import { UnverifiedBanner } from "~/components/UnverifiedBanner";
import { getRequestsSeenAt, requestsSeenVersion } from "~/lib/requestsSeen";
import { countUnreadIncomingMessages } from "~/lib/chat";

const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

export function AppShell(props: { children: import("solid-js").JSX.Element }) {
  const nav = useNavigate();
  const user = () => {
    authVersion(); // Re-render when auth data changes (e.g. avatar upload)
    return pb.authStore.model;
  };
  const me = () => (pb.authStore.isValid ? pb.authStore.model?.id : undefined);
  const [menuOpen, setMenuOpen] = createSignal(false);
  let menuLinksRef: HTMLDivElement | undefined;
  let hamburgerRef: HTMLButtonElement | undefined;

  createEffect((prev) => {
    const open = menuOpen();
    if (open) {
      menuLinksRef?.focus();
    } else if (prev === true) {
      hamburgerRef?.focus({ preventScroll: true });
    }
    return open;
  }, false);

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

  const [unreadChatCount] = createResource(
    () => me(),
    async (userId) => {
      if (!userId) return 0;
      try {
        const messages = await pb.collection("messages").getFullList<{
          sender: string;
          read_at?: string;
        }>({
          requestKey: "appshell-unread-chat",
        });
        return countUnreadIncomingMessages(messages, userId);
      } catch {
        return 0;
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
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
    if (!done) {
      nav("/onboarding/choice", { replace: true });
      return;
    }
    // Throttled ping to update last_login_at (for "Senast aktiv" sort on matches)
    const userId = pb.authStore.model?.id;
    if (userId && typeof sessionStorage !== "undefined") {
      const key = "last_login_ping";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      const fiveMin = 5 * 60 * 1000;
      if (!last || now - parseInt(last, 10) > fiveMin) {
        sessionStorage.setItem(key, String(now));
        pb.collection("users")
          .update(userId, { last_login_at: new Date().toISOString() })
          .catch(() => {});
      }
    }
  });

  function logout() {
    pb.authStore.clear();
    nav("/", { replace: true });
  }

  function handleMenuKeyDown(e: KeyboardEvent) {
    if (e.key !== "Tab" || !menuOpen()) return;
    const el = e.currentTarget as HTMLElement;
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div>
      <nav class="app-nav">
        <div class="app-nav-brand">
          <A href="/app/matches" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem;">
            <img src="/logo-icon.png" alt="" width="28" height="28" style="border-radius: 6px;" />
            Hundkrets
          </A>
          <Avatar
            name={user()?.name}
            city={user()?.city}
            neighborhood={user()?.neighborhood}
            size="sm"
            class="avatar-sm app-nav-avatar"
            verified={(user() as { verified?: boolean } | null)?.verified}
            id={user()?.id}
            avatar={(user() as { avatar?: string } | null)?.avatar}
            baseUrl={baseUrl}
          />
        </div>
        <button
          ref={hamburgerRef}
          type="button"
          class="app-nav-hamburger"
          classList={{ "app-nav-hamburger-open": menuOpen() }}
          aria-label={menuOpen() ? "Stäng meny" : "Öppna meny"}
          aria-expanded={menuOpen()}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span class="app-nav-hamburger-bar" />
          <span class="app-nav-hamburger-bar" />
          <span class="app-nav-hamburger-bar" />
        </button>
        <div
          class="app-nav-links"
          classList={{ "app-nav-links-open": menuOpen() }}
          ref={menuLinksRef}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          <A href="/app/matches" class="nav-link-with-badge" style="position: relative;" onClick={() => setMenuOpen(false)}>
            Utforska
            <Show when={badgeCount() > 0}>
              <span class="nav-badge" aria-label={`${badgeCount()} nya`}>{badgeCount()}</span>
            </Show>
          </A>
          <A href="/app/overview" onClick={() => setMenuOpen(false)}>Översikt</A>
          <A href="/app/profile" onClick={() => setMenuOpen(false)}>Profil</A>
          <A href="/app/dogs" onClick={() => setMenuOpen(false)}>Mina hundar</A>
          <A href="/app/needs" onClick={() => setMenuOpen(false)}>Mina behov</A>
          <A href="/app/capacity" onClick={() => setMenuOpen(false)}>Min kapacitet</A>
          <A href="/app/chats" class="nav-link-with-badge" style="position: relative;" onClick={() => setMenuOpen(false)}>
            Chattar
            <Show when={(unreadChatCount() ?? 0) > 0}>
              <span class="nav-badge" aria-label={`${unreadChatCount()} olästa`}>
                {unreadChatCount()}
              </span>
            </Show>
          </A>
          <button type="button" class="btn btn-secondary" onClick={() => { setMenuOpen(false); logout(); }}>
            Logga ut
          </button>
        </div>
      </nav>
      <AdminMessageBanner />
      <UnverifiedBanner />
      {props.children}
    </div>
  );
}
