import { A, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, onCleanup, onMount, Show } from "solid-js";
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
    return pb?.authStore?.model;
  };
  const me = () => (pb?.authStore?.isValid ? pb.authStore.model?.id : undefined);
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

  const [connections, { refetch: refetchConnections }] = createResource(
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

  const [unreadChatCount, { refetch: refetchUnreadChat }] = createResource(
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

  const incomingRequestsCount = createMemo(() => {
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
    return conns.filter((c) => c.to_user === myId && !mutual.has(c.from_user)).length;
  });

  const chatBadgeCount = createMemo(
    () => (unreadChatCount() ?? 0) + incomingRequestsCount()
  );

  createEffect(() => {
    const meId = me();
    if (!meId) return;
    let closed = false;
    let unsubConn: (() => void) | undefined;
    let unsubMsg: (() => void) | undefined;
    void Promise.all([
      pb.collection("connection_requests").subscribe("*", () => void refetchConnections()),
      pb.collection("messages").subscribe("*", () => void refetchUnreadChat()),
    ]).then(([a, b]) => {
      if (closed) {
        a();
        b();
        return;
      }
      unsubConn = a;
      unsubMsg = b;
    }).catch(() => {});
    onCleanup(() => {
      closed = true;
      unsubConn?.();
      unsubMsg?.();
    });
  });

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
    if (!pb?.authStore?.isValid) {
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
    pb?.authStore?.clear();
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
    <div class="app-shell">
      <nav class="app-nav">
        <div class="app-nav-inner">
          <div class="app-nav-brand">
            <A href="/app/explore" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem;">
              <img src="/logo-icon.png" alt="" width="28" height="28" style="border-radius: 6px;" />
              Hundkrets
            </A>
          </div>
          <A href="/app/profile" class="app-nav-avatar-mobile" aria-label="Profil" onClick={() => setMenuOpen(false)}>
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
          </A>
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
            class="app-nav-menu"
            classList={{ "app-nav-links-open": menuOpen() }}
            ref={menuLinksRef}
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
          >
            <div class="app-nav-links">
              <A href="/app/explore" class="nav-link-with-badge" onClick={() => setMenuOpen(false)}>
                Utforska
                <Show when={badgeCount() > 0}>
                  <span class="nav-badge-inline" aria-label={`${badgeCount()} nya`}> ({badgeCount()})</span>
                </Show>
              </A>
              <A href="/app/profile" onClick={() => setMenuOpen(false)}>Profil</A>
              <A href="/app/chats" class="nav-link-with-badge" onClick={() => setMenuOpen(false)}>
                Chattar
                <Show when={(chatBadgeCount() ?? 0) > 0}>
                  <span class="nav-badge-inline" aria-label={`${chatBadgeCount()} nya`}> ({chatBadgeCount()})</span>
                </Show>
              </A>
            </div>
            <div class="app-nav-right">
              <A href="/app/profile" class="app-nav-avatar-link" onClick={() => setMenuOpen(false)} aria-label="Profil">
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
              </A>
              <button type="button" class="btn btn-secondary app-nav-logout" onClick={() => { setMenuOpen(false); logout(); }}>
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </nav>
      <AdminMessageBanner />
      <UnverifiedBanner />
      <main class="app-main">{props.children}</main>
    </div>
  );
}
