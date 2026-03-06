import { createEffect, createMemo, createResource, createSignal, onCleanup, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";

type MessageType = "news" | "warning";
type RouteKey = "app_home" | "overview" | "profile" | "dogs" | "needs" | "capacity" | "chats" | "matches";

type AdminMessage = {
  id: string;
  text: string;
  start_date: string;
  end_date: string;
  pages?: string[] | string;
  ttl_seconds?: number | null;
  message_type: MessageType;
  is_moving?: boolean;
};

function getRouteKey(pathname: string): RouteKey | null {
  if (pathname === "/app") return "app_home";
  if (pathname === "/app/overview") return "overview";
  if (pathname === "/app/profile" || pathname === "/app/settings") return "profile";
  if (pathname.startsWith("/app/dogs")) return "dogs";
  if (pathname.startsWith("/app/needs")) return "needs";
  if (pathname.startsWith("/app/capacity")) return "capacity";
  if (pathname.startsWith("/app/chats")) return "chats";
  if (pathname === "/app/matches") return "matches";
  return null;
}

function normalizePages(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function endDateToTimestamp(value: string): number {
  // Date-only values should remain visible until the end of the selected day.
  const hasExplicitTime = value.includes("T") || value.includes(" ");
  if (hasExplicitTime) return new Date(value).getTime();
  return new Date(`${value}T23:59:59.999`).getTime();
}

function storageKey(userId: string): string {
  return `admin_message_dismissed_${userId}`;
}

function loadDismissed(userId: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persistDismissed(userId: string, dismissed: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify([...dismissed]));
}

export function AdminMessageBanner() {
  const [dismissed, setDismissed] = createSignal<Set<string>>(new Set());
  const userId = () => (pb.authStore.isValid ? pb.authStore.model?.id ?? null : null);
  const pathname = () => (typeof window === "undefined" ? "" : window.location.pathname);

  createEffect(() => {
    const id = userId();
    if (!id) {
      setDismissed(new Set());
      return;
    }
    setDismissed(loadDismissed(id));
  });

  const [messages] = createResource(
    () => userId(),
    async (id) => {
      if (!id) return [];
      try {
        return await pb.collection("admin_messages").getFullList<AdminMessage>({
          sort: "-start_date",
          requestKey: "admin-message-banner",
        });
      } catch {
        return [];
      }
    }
  );

  const activeMessage = createMemo(() => {
    const all = messages() ?? [];
    if (all.length === 0) return null;

    const nowTs = Date.now();
    const routeKey = getRouteKey(pathname());
    const dismissedSet = dismissed();

    for (const message of all) {
      if (dismissedSet.has(message.id)) continue;
      const startTs = new Date(message.start_date).getTime();
      const endTs = endDateToTimestamp(message.end_date);
      if (Number.isNaN(startTs) || Number.isNaN(endTs)) continue;
      if (startTs > nowTs || endTs < nowTs) continue;

      const pages = normalizePages(message.pages);
      if (pages.length > 0 && !pages.includes("all")) {
        if (!routeKey || !pages.includes(routeKey)) continue;
      }

      return message;
    }

    return null;
  });

  createEffect(() => {
    const current = activeMessage();
    if (!current) return;
    const ttl = Number(current.ttl_seconds ?? 0);
    if (!Number.isFinite(ttl) || ttl <= 0) return;

    const timer = setTimeout(() => {
      const id = userId();
      if (!id) return;
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(current.id);
        persistDismissed(id, next);
        return next;
      });
    }, ttl * 1000);

    onCleanup(() => clearTimeout(timer));
  });

  function dismissCurrent() {
    const current = activeMessage();
    const id = userId();
    if (!current || !id) return;
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(current.id);
      persistDismissed(id, next);
      return next;
    });
  }

  return (
    <Show when={activeMessage()}>
      {(message) => (
        <section class={`admin-message-banner admin-message-banner-${message().message_type}`} role="status" aria-live="polite">
          <div class="admin-message-banner-content">
            <Show
              when={message().is_moving}
              fallback={<p class="admin-message-banner-text">{message().text}</p>}
            >
              <div class="admin-message-banner-marquee">
                <p class="admin-message-banner-text admin-message-banner-text-moving">{message().text}</p>
              </div>
            </Show>
            <button type="button" class="admin-message-banner-close" aria-label="Stäng meddelande" onClick={dismissCurrent}>
              ×
            </button>
          </div>
        </section>
      )}
    </Show>
  );
}
