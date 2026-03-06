import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { getRequestsSeenAt, markRequestsSeen, requestsSeenVersion } from "~/lib/requestsSeen";
import { parseApiError } from "~/lib/errors";
import { showToast } from "~/lib/toast";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isUserVerified } from "~/lib/auth";
import { findListings } from "~/lib/matching";
import { approximateCoords, pointInBounds, type MapBounds } from "~/lib/geocode";
import { AppShell } from "~/components/AppShell";
import { MatchesMap } from "~/components/MatchesMap";
import { MatchCards } from "./matches/MatchCard";
import { InterestModal } from "./matches/InterestModal";
import { RespondModal } from "./matches/RespondModal";
import type { Conn } from "./matches/types";
import {
  DEFAULT_MAX_DISTANCE_KM,
  dateStr,
  sizesStr,
  filterFromParams,
  buildMatchesUrl,
  buildMatchesParams,
  getExchangeType,
  type MatchFilter,
  type MatchSort,
} from "./matches/helpers";

export default function Matches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = createSignal(false);
  const [matchFilter, setMatchFilter] = createSignal<MatchFilter>("all");
  const [excludeGive, setExcludeGive] = createSignal(false);
  const [excludeMutual, setExcludeMutual] = createSignal(false);
  const [excludeReceive, setExcludeReceive] = createSignal(false);
  const [matchSort, setMatchSort] = createSignal<MatchSort>("active");
  const [sortRowVisible, setSortRowVisible] = createSignal(
    typeof window !== "undefined"
      ? (localStorage.getItem("matches-sort-visible") ?? "true") === "true"
      : true
  );
  const [excludeRowVisible, setExcludeRowVisible] = createSignal(
    typeof window !== "undefined"
      ? (localStorage.getItem("matches-include-visible") ?? "true") === "true"
      : true
  );
  const [filterRowVisible, setFilterRowVisible] = createSignal(
    typeof window !== "undefined"
      ? (localStorage.getItem("matches-filter-visible") ?? "true") === "true"
      : true
  );
  const [mobileFilterOpen, setMobileFilterOpen] = createSignal(false);
  const [hoveredUserId, setHoveredUserId] = createSignal<string | undefined>(undefined);

  const filterLabel = () =>
    matchFilter() === "all"
      ? "Alla"
      : matchFilter() === "matched"
        ? "Matchade"
        : matchFilter() === "not_matched"
          ? "Tillgängliga"
          : matchFilter() === "outgoing"
            ? "Skickade"
            : "Mottagna";

  const [introDismissed, setIntroDismissed] = createSignal(
    typeof window !== "undefined" && localStorage.getItem("matches-intro-dismissed") === "true"
  );

  createEffect(() => {
    const p = searchParams as Record<string, string | undefined>;
    const { filter, excludeGive: eg, excludeMutual: em, excludeReceive: er, sort } = filterFromParams(p);
    setMatchFilter(filter);
    setExcludeGive(eg);
    setExcludeMutual(em);
    setExcludeReceive(er);
    setMatchSort(sort);
  });
  createEffect(() => {
    if (typeof window === "undefined") return;
    const url = buildMatchesUrl({
      filter: matchFilter(),
      excludeGive: excludeGive(),
      excludeMutual: excludeMutual(),
      excludeReceive: excludeReceive(),
      sort: matchSort(),
    });
    const current = window.location.pathname + (window.location.search || "");
    if (current !== url) navigate(url, { replace: true });
  });

  createEffect(() => {
    if ((searchParams as { request?: string }).request === "true") markRequestsSeen();
  });
  const [mapBounds, setMapBounds] = createSignal<MapBounds | null>(null);
  const [mobileViewMode, setMobileViewMode] = createSignal<"list" | "map">("list");
  const [isMobileViewport, setIsMobileViewport] = createSignal(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = () => setIsMobileViewport(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });
  let listContainerRef: HTMLDivElement | undefined;

  const [data, { refetch, mutate }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return null;
      try {
        const [needs, capacities, users, dogs, connectionsResult] = await Promise.all([
          pb.collection("watch_needs").getFullList(),
          pb.collection("watch_capacity").getFullList(),
          pb.collection("users").getFullList(),
          pb.collection("dogs").getFullList(),
          pb.collection("connection_requests")
            .getFullList({ requestKey: "matches-connections" })
            .catch((err) => {
              console.error("[matches] connection_requests fetch failed", err);
              return [];
            }),
        ]);
        const connections = connectionsResult as unknown[];
        const extractId = (v: unknown): string => {
          if (typeof v === "string") return v;
          if (v && typeof v === "object") {
            const o = v as { id?: string };
            if (typeof o.id === "string") return o.id;
          }
          if (Array.isArray(v) && v.length > 0) return extractId(v[0]);
          return "";
        };
        const connFrom = (c: unknown) => extractId((c as { from_user?: unknown }).from_user);
        const connTo = (c: unknown) => extractId((c as { to_user?: unknown }).to_user);
        const connId = (c: unknown) =>
          typeof (c as { id?: string }).id === "string" ? (c as { id: string }).id : "";
        const baseListings = findListings(
          needs as Parameters<typeof findListings>[0],
          capacities as Parameters<typeof findListings>[1],
          userId,
          users as Parameters<typeof findListings>[3],
          dogs as Parameters<typeof findListings>[4],
          DEFAULT_MAX_DISTANCE_KM
        );
        const listingUserIds = new Set(baseListings.map((l) => l.user.id));
        const requestedMeIds = connections.filter((c) => connTo(c) === userId).map((c) => connFrom(c));
        const outgoingIds = connections
          .filter(
            (c) =>
              connFrom(c) === userId &&
              !connections.some((r) => connFrom(r) === connTo(c) && connTo(r) === userId)
          )
          .map((c) => connTo(c));
        const usersArr = users as {
          id: string;
          latitude?: number;
          longitude?: number;
          [k: string]: unknown;
        }[];
        const needsArr = needs as { user: string; dog: string; [k: string]: unknown }[];
        const capacitiesArr = capacities as { user: string; [k: string]: unknown }[];
        const dogsArr = dogs as { id: string; owner: string; [k: string]: unknown }[];
        const needsByUser = new Map<string, typeof needsArr>();
        for (const n of needsArr) {
          if (!needsByUser.has(n.user)) needsByUser.set(n.user, []);
          needsByUser.get(n.user)!.push(n);
        }
        const capacitiesByUser = new Map<string, typeof capacitiesArr>();
        for (const c of capacitiesArr) {
          if (!capacitiesByUser.has(c.user)) capacitiesByUser.set(c.user, []);
          capacitiesByUser.get(c.user)!.push(c);
        }
        const dogMap = new Map(dogsArr.map((d) => [d.id, d]));
        const extraListings: typeof baseListings = [];
        const addExtraListing = (uid: string) => {
          if (listingUserIds.has(uid)) return;
          const user = usersArr.find((u) => u.id === uid);
          if (!user) return;
          const userNeeds = needsByUser.get(uid) ?? [];
          const userCapacities = capacitiesByUser.get(uid) ?? [];
          const userDogIds = new Set(userNeeds.map((n) => n.dog));
          const userDogs = [...userDogIds]
            .map((id) => dogMap.get(id))
            .filter(Boolean) as typeof dogsArr;
          extraListings.push({
            user: user as (typeof baseListings)[0]["user"],
            needs: userNeeds as (typeof baseListings)[0]["needs"],
            capacities: userCapacities as (typeof baseListings)[0]["capacities"],
            dogs: userDogs,
          });
          listingUserIds.add(uid);
        };
        for (const uid of requestedMeIds) addExtraListing(uid);
        for (const uid of outgoingIds) addExtraListing(uid);
        const listings = [...baseListings, ...extraListings].sort(
          (a, b) =>
            ((a as { distanceKm?: number }).distanceKm ?? 999) -
            ((b as { distanceKm?: number }).distanceKm ?? 999)
        );
        const normalizedConnections = connections.map((c) => ({
          id: connId(c),
          from_user: connFrom(c),
          to_user: connTo(c),
          message: (c as { message?: string }).message,
        }));
        const myNeeds = (
          needsArr as {
            user: string;
            start_date?: string;
            end_date?: string;
            flexible_dates?: boolean;
          }[]
        ).filter((n) => n.user === userId);
        const myCapacities = (
          capacitiesArr as {
            user: string;
            start_date?: string;
            end_date?: string;
            flexible_dates?: boolean;
          }[]
        ).filter((c) => c.user === userId);
        return { listings, connections: normalizedConnections, myNeeds, myCapacities };
      } catch (err) {
        const e = err as { status?: number; message?: string; url?: string };
        console.error("Matches fetch failed:", e?.status, e?.message, e?.url);
        throw err;
      }
    }
  );

  async function handleInterested(toUserId: string, message?: string) {
    const fromUserId = pb.authStore.model?.id;
    if (!fromUserId) return;
    setRefreshing(true);
    try {
      const created = await pb.collection("connection_requests").create({
        from_user: fromUserId,
        to_user: toUserId,
        ...(message?.trim() && { message: message.trim() }),
      });
      mutate((prev) => {
        if (!prev) return prev;
        return { ...prev, connections: [...prev.connections, created] };
      });
      showToast("Intresse skickat");
    } catch (e) {
      const err = e as { response?: { data?: unknown }; data?: unknown };
      console.error("[matches] handleInterested error", e);
      console.error("[matches] response.data:", err?.response?.data ?? err?.data);
      showToast(parseApiError(e), "error");
      refetch();
      throw e;
    } finally {
      setRefreshing(false);
    }
  }

  async function handleWithdraw(toUserId: string) {
    const me = pb.authStore.model?.id;
    if (!me || !data()?.connections) return;
    const conn = (data()!.connections as { id: string; from_user: string; to_user: string }[]).find(
      (c) => c.from_user === me && c.to_user === toUserId
    );
    if (!conn?.id) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").delete(conn.id);
      mutate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          connections: prev.connections.filter((c: { id: string }) => c.id !== conn.id),
        };
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUnmatch(otherUserId: string) {
    const me = pb.authStore.model?.id;
    if (!me || !data()?.connections) return;
    const conns = (
      data()!.connections as { id?: string; from_user: string; to_user: string }[]
    ).filter(
      (c) =>
        c.id &&
        ((c.from_user === me && c.to_user === otherUserId) ||
          (c.from_user === otherUserId && c.to_user === me))
    );
    const idsToRemove = new Set(conns.map((c) => c.id).filter(Boolean));
    setRefreshing(true);
    try {
      for (const conn of conns) {
        if (conn.id) await pb.collection("connection_requests").delete(conn.id);
      }
      mutate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          connections: prev.connections.filter(
            (c: { id?: string }) => !c.id || !idsToRemove.has(c.id)
          ),
        };
      });
    } catch (e) {
      console.error("[matches] handleUnmatch error", e);
      refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function ensureConversation(otherUserId: string): Promise<string> {
    const myId = pb.authStore.model?.id;
    if (!myId) throw new Error("Inte inloggad");
    const userA = myId < otherUserId ? myId : otherUserId;
    const userB = myId < otherUserId ? otherUserId : myId;
    const key = `${userA}:${userB}`;

    try {
      const existing = await pb
        .collection("conversations")
        .getFirstListItem(`pair_key = "${key}"`);
      return existing.id;
    } catch {}

    try {
      const existingByUsers = await pb
        .collection("conversations")
        .getFirstListItem(
          `(user_a = "${myId}" && user_b = "${otherUserId}") || (user_a = "${otherUserId}" && user_b = "${myId}")`
        );
      return existingByUsers.id;
    } catch {}

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
      console.error("[matches] handleOpenChat error", err);
      showToast("Kunde inte öppna chatt just nu.", "error");
    }
  }

  function isMutual(listingUserId: string): boolean {
    const me = pb.authStore.model?.id;
    const conns = data()?.connections;
    if (!me || !conns) return false;
    const connsArr = conns as { from_user: string; to_user: string }[];
    const iReq = connsArr.some((c) => c.from_user === me && c.to_user === listingUserId);
    const theyReq = connsArr.some((c) => c.from_user === listingUserId && c.to_user === me);
    return iReq && theyReq;
  }

  const [interestModalTarget, setInterestModalTarget] = createSignal<
    { userId: string; userName?: string } | undefined
  >();
  const [interestModalMessage, setInterestModalMessage] = createSignal("");

  function openInterestModal(userId: string, userName?: string) {
    setInterestModalTarget({ userId, userName });
    setInterestModalMessage("");
  }

  function closeInterestModal() {
    setInterestModalTarget(undefined);
    setInterestModalMessage("");
  }

  async function submitInterestModal() {
    const target = interestModalTarget();
    if (!target) return;
    try {
      await handleInterested(target.userId, interestModalMessage().trim() || undefined);
      closeInterestModal();
    } catch {
      // Modal stays open on error so user can retry
    }
  }

  const [respondModalTarget, setRespondModalTarget] = createSignal<
    { requestId: string; fromUserId: string; fromUserName?: string } | undefined
  >();
  const [respondModalMessage, setRespondModalMessage] = createSignal("");

  function openRespondModal(conn: Conn, fromUserName?: string) {
    if (!conn.id) return;
    setRespondModalTarget({
      requestId: conn.id,
      fromUserId: conn.from_user,
      fromUserName,
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
    setRefreshing(true);
    try {
      const created = await pb.collection("connection_requests").create({
        from_user: pb.authStore.model!.id,
        to_user: target.fromUserId,
        ...(respondModalMessage().trim() && { message: respondModalMessage().trim() }),
      });
      mutate((prev) => {
        if (!prev) return prev;
        return { ...prev, connections: [...prev.connections, created] };
      });
      closeRespondModal();
      showToast("Matchad! Ni kan nu kontakta varandra.");
    } catch (e) {
      console.error("[matches] handleAcceptWithReply error", e);
      showToast(parseApiError(e), "error");
      refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRejectRequest() {
    const target = respondModalTarget();
    if (!target) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").delete(target.requestId);
      mutate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          connections: prev.connections.filter((c: { id?: string }) => c.id !== target.requestId),
        };
      });
      closeRespondModal();
    } catch (e) {
      console.error("[matches] handleRejectRequest error", e);
      showToast(parseApiError(e), "error");
      refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpenDetail(userId: string) {
    navigate(`/users/${userId}?from=matches`);
  }

  function handleFilterChange(filter: MatchFilter) {
    setMatchFilter(filter);
    if (filter === "requested_me") markRequestsSeen();
    setSearchParams(
      buildMatchesParams({
        filter,
        excludeGive: excludeGive(),
        excludeMutual: excludeMutual(),
        excludeReceive: excludeReceive(),
        sort: matchSort(),
      }),
      { replace: true }
    );
  }

  function handleSortChange(sort: MatchSort) {
    setMatchSort(sort);
    setSearchParams(
      buildMatchesParams({
        filter: matchFilter(),
        excludeGive: excludeGive(),
        excludeMutual: excludeMutual(),
        excludeReceive: excludeReceive(),
        sort,
      }),
      { replace: true }
    );
  }

  function handleExcludeToggle(type: "give" | "mutual" | "receive") {
    const next = !(type === "give" ? excludeGive() : type === "mutual" ? excludeMutual() : excludeReceive());
    if (type === "give") setExcludeGive(next);
    else if (type === "mutual") setExcludeMutual(next);
    else setExcludeReceive(next);
    setSearchParams(
      buildMatchesParams({
        filter: matchFilter(),
        excludeGive: type === "give" ? next : excludeGive(),
        excludeMutual: type === "mutual" ? next : excludeMutual(),
        excludeReceive: type === "receive" ? next : excludeReceive(),
        sort: matchSort(),
      }),
      { replace: true }
    );
  }

  function handleClearFilters() {
    setMatchFilter("all");
    setExcludeGive(false);
    setExcludeMutual(false);
    setExcludeReceive(false);
    setMatchSort("active");
    setSearchParams({}, { replace: true });
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  const requestedMeUserIds = createMemo(() => {
    const me = pb.authStore.model?.id;
    const conns = data()?.connections;
    if (!me || !conns) return new Set<string>();
    const set = new Set<string>();
    for (const c of conns as { from_user: string; to_user: string }[]) {
      if (c.to_user === me) set.add(c.from_user);
    }
    return set;
  });

  const outgoingUserIds = createMemo(() => {
    const me = pb.authStore.model?.id;
    const conns = data()?.connections;
    if (!me || !conns) return new Set<string>();
    const mutual = new Set<string>();
    for (const c of conns as { from_user: string; to_user: string }[]) {
      const other = c.from_user === me ? c.to_user : c.to_user === me ? c.from_user : null;
      if (!other) continue;
      const iReq = conns.some(
        (x: { from_user: string; to_user: string }) => x.from_user === me && x.to_user === other
      );
      const theyReq = conns.some(
        (x: { from_user: string; to_user: string }) => x.from_user === other && x.to_user === me
      );
      if (iReq && theyReq) mutual.add(other);
    }
    const set = new Set<string>();
    for (const c of conns as { from_user: string; to_user: string }[]) {
      if (c.from_user === me && !mutual.has(c.to_user)) set.add(c.to_user);
    }
    return set;
  });

  const requestedMeUnseenCount = createMemo(() => {
    requestsSeenVersion();
    const conns = data()?.connections ?? [];
    const me = pb.authStore.model?.id;
    if (!me) return 0;
    const mutual = new Set<string>();
    for (const c of conns as { from_user: string; to_user: string }[]) {
      const other = c.from_user === me ? c.to_user : c.to_user === me ? c.from_user : null;
      if (!other) continue;
      const iReq = conns.some(
        (x: { from_user: string; to_user: string }) => x.from_user === me && x.to_user === other
      );
      const theyReq = conns.some(
        (x: { from_user: string; to_user: string }) => x.from_user === other && x.to_user === me
      );
      if (iReq && theyReq) mutual.add(other);
    }
    const incoming = (conns as { from_user: string; to_user: string; created?: string }[]).filter(
      (c) => c.to_user === me && !mutual.has(c.from_user)
    );
    const seenAt = getRequestsSeenAt();
    return seenAt ? incoming.filter((c) => c.created && c.created > seenAt).length : incoming.length;
  });

  const tabCounts = createMemo(() => {
    const listings = data()?.listings ?? [];
    const requestedMe = requestedMeUserIds();
    const outgoing = outgoingUserIds();
    return {
      all: listings.length,
      matched: listings.filter((l) => isMutual(l.user.id)).length,
      not_matched: listings.filter((l) => !isMutual(l.user.id)).length,
      outgoing: listings.filter((l) => outgoing.has(l.user.id)).length,
      requested_me: listings.filter((l) => requestedMe.has(l.user.id)).length,
    };
  });

  const matchFilteredListings = createMemo(() => {
    let listings = data()?.listings ?? [];
    const filter = matchFilter();
    if (filter === "matched") listings = listings.filter((l) => isMutual(l.user.id));
    else if (filter === "not_matched") listings = listings.filter((l) => !isMutual(l.user.id));
    else if (filter === "requested_me")
      listings = listings.filter((l) => requestedMeUserIds().has(l.user.id));
    else if (filter === "outgoing")
      listings = listings.filter((l) => outgoingUserIds().has(l.user.id));

    if (excludeGive()) listings = listings.filter((l) => getExchangeType(l) !== "give");
    if (excludeMutual()) listings = listings.filter((l) => getExchangeType(l) !== "mutual");
    if (excludeReceive()) listings = listings.filter((l) => getExchangeType(l) !== "receive");

    const sort = matchSort();
    if (sort === "recent") {
      listings = [...listings].sort((a, b) => {
        const aC = (a.user as { created?: string }).created ?? "";
        const bC = (b.user as { created?: string }).created ?? "";
        return bC.localeCompare(aC);
      });
    } else if (sort === "active") {
      listings = [...listings].sort((a, b) => {
        const aL = (a.user as { last_login_at?: string }).last_login_at;
        const bL = (b.user as { last_login_at?: string }).last_login_at;
        if (!aL && !bL) return 0;
        if (!aL) return 1;
        if (!bL) return -1;
        return bL.localeCompare(aL);
      });
    } else {
      listings = [...listings].sort(
        (a, b) =>
          ((a as { distanceKm?: number }).distanceKm ?? 999) -
          ((b as { distanceKm?: number }).distanceKm ?? 999)
      );
    }
    return listings;
  });

  const filteredListings = createMemo(() => {
    const listings = matchFilteredListings();
    if (isMobileViewport() && mobileViewMode() === "list") return listings;
    const bounds = mapBounds();
    if (!bounds) return listings;
    return listings.filter((listing) => {
      const u = listing.user as { id?: string; latitude?: number; longitude?: number };
      if (typeof u.latitude !== "number" || typeof u.longitude !== "number") return false;
      const [lat, lon] = approximateCoords(u.latitude, u.longitude, u.id ?? "");
      return pointInBounds(lat, lon, bounds);
    });
  });

  return (
    <AppShell>
      <div class="matches-page">
        <div class="matches-sticky-header">
        <div class="container matches-header-container">
          <Show when={!introDismissed() && (!isMobileViewport() || !(data()?.listings && data()!.listings.length > 0))}>
            <div class="page-hero">
              <div class="matches-intro-box">
                <span class="paw-emoji">🐾</span>
                <h1>Matchningar</h1>
                <p style="color: var(--color-text-muted); margin: 0;">
                  Hundägare i ditt område som vill byta hundpassning. Klicka "Jag är intresserad" för
                  att koppla ihop—när de gör det kan ni dela uppgifter och chatta.
                </p>
                <button
                  type="button"
                  class="matches-intro-close"
                  onClick={() => {
                    setIntroDismissed(true);
                    if (typeof localStorage !== "undefined") {
                      localStorage.setItem("matches-intro-dismissed", "true");
                    }
                  }}
                  aria-label="Stäng"
                  title="Stäng – visas inte igen"
                >
                  ×
                </button>
              </div>
            </div>
          </Show>
          <Show when={!pb.authStore.model?.area && !pb.authStore.model?.city}>
            <div class="profile-incomplete-card">
              <h3 style="margin: 0 0 0.5rem; color: var(--color-paw-dark);">
                Profilen behöver uppdateras
              </h3>
              <p style="margin: 0 0 1rem; color: var(--color-text-muted);">
                Din adress behövs för att hitta hundägare i ditt område. Matchningar visas baserat på
                närhet—utan adress kan vi inte visa relevanta personer.
              </p>
              <ul class="profile-incomplete-checklist">
                <li style="color: #dc2626;">Adress saknas</li>
                <Show when={!pb.authStore.model?.avatar}>
                  <li style="color: var(--color-text-muted);">Profilbild (valfritt)</li>
                </Show>
              </ul>
              <A href="/app/settings" class="btn">
                Gå till profil och ange adress
              </A>
            </div>
          </Show>
          <Show
            when={
              pb.authStore.model?.area &&
              !pb.authStore.model?.latitude &&
              !pb.authStore.model?.longitude
            }
          >
            <div class="profile-incomplete-card profile-incomplete-card-subtle">
              <p style="margin: 0 0 0.75rem; color: var(--color-text-muted);">
                Uppdatera din profil med full adress för att filtrera på avstånd och se kartan.
              </p>
              <A href="/app/settings" class="btn btn-secondary">
                Uppdatera adress
              </A>
            </div>
          </Show>
          <Show when={data.loading && !data()}>
            <p>Laddar...</p>
          </Show>
          <Show when={data.error}>
            <p style="color: #dc2626;">Kunde inte ladda matchningar: {data.error?.message}</p>
            <p style="color: var(--color-text-muted); font-size: 0.875rem;">
              Kontrollera att PocketBase körs på{" "}
              {import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090"}
            </p>
            <button type="button" class="btn" onClick={() => refetch()}>
              Försök igen
            </button>
          </Show>
          <Show when={data()?.listings.length === 0 && !data.loading && pb.authStore.model?.area}>
            <p>
              Ingen i ditt område än. Lägg till dina behov och kapacitet så att andra kan hitta dig.
            </p>
            <A href="/app/needs" class="btn">
              Lägg till behov
            </A>
            <A href="/app/capacity" class="btn btn-secondary" style="margin-left: 0.5rem;">
              Lägg till kapacitet
            </A>
          </Show>
          <Show when={data()?.listings && data()!.listings.length > 0}>
            {/* Mobile: Utforska header + filter icon */}
            <Show when={isMobileViewport()}>
              <div class="matches-mobile-header">
                <h1 class="matches-mobile-title">Utforska</h1>
                <button
                  type="button"
                  class="matches-filter-icon-btn"
                  classList={{ "matches-filter-icon-active": mobileFilterOpen() }}
                  onClick={() => setMobileFilterOpen((o) => !o)}
                  aria-label={mobileFilterOpen() ? "Dölj filter" : "Visa filter"}
                  aria-expanded={mobileFilterOpen()}
                >
                  <Show when={mobileFilterOpen()} fallback={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" role="img">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  }>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" role="img">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </Show>
                </button>
              </div>
              <div
                class="matches-mobile-filter-section"
                classList={{ "matches-mobile-filter-section-open": mobileFilterOpen() }}
              >
                  <div class="matches-mobile-filter-header">
                    <span class="matches-mobile-filter-title">Filter</span>
                    <button
                      type="button"
                      class="matches-mobile-filter-clear"
                      onClick={handleClearFilters}
                    >
                      Rensa
                    </button>
                  </div>
                  <div class="matches-mobile-filter-content">
                    <div class="matches-mobile-filter-group">
                      <span class="matches-mobile-filter-label">Kategori</span>
                      <div class="matches-filter-tabs" role="tablist">
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchFilter() === "all" }} onClick={() => handleFilterChange("all")}>Alla ({tabCounts().all})</button>
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchFilter() === "matched" }} onClick={() => handleFilterChange("matched")}>Matchade ({tabCounts().matched})</button>
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchFilter() === "not_matched" }} onClick={() => handleFilterChange("not_matched")}>Tillgängliga ({tabCounts().not_matched})</button>
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchFilter() === "outgoing" }} onClick={() => handleFilterChange("outgoing")}>Skickade ({tabCounts().outgoing})</button>
                        <button type="button" role="tab" class="matches-filter-tab matches-filter-tab-with-badge" classList={{ "matches-filter-tab-active": matchFilter() === "requested_me" }} onClick={() => handleFilterChange("requested_me")}>
                          <Show when={requestedMeUnseenCount() > 0} fallback={<>Mottagna ({tabCounts().requested_me})</>}>
                            Mottagna <span class="matches-filter-tab-badge" aria-label={`${requestedMeUnseenCount()} nya`}>{requestedMeUnseenCount()}</span>
                          </Show>
                        </button>
                      </div>
                    </div>
                    <div class="matches-mobile-filter-group">
                      <span class="matches-mobile-filter-label">Inkludera</span>
                      <div class="matches-exclude-tabs" role="group">
                        <button type="button" class="matches-exclude-tab" classList={{ "matches-exclude-tab-active": !excludeGive() }} onClick={() => handleExcludeToggle("give")} title="Inkludera de som vill bara passa hundar">Vill bara passa</button>
                        <button type="button" class="matches-exclude-tab" classList={{ "matches-exclude-tab-active": !excludeMutual() }} onClick={() => handleExcludeToggle("mutual")} title="Inkludera utbytare">Utbytare</button>
                        <button type="button" class="matches-exclude-tab" classList={{ "matches-exclude-tab-active": !excludeReceive() }} onClick={() => handleExcludeToggle("receive")} title="Inkludera de som vill bara få passning">Vill bara få passning</button>
                      </div>
                    </div>
                    <div class="matches-mobile-filter-group">
                      <span class="matches-mobile-filter-label">Sortera</span>
                      <div class="matches-sort-tabs" role="tablist">
                        <button type="button" role="tab" class="matches-sort-tab" classList={{ "matches-sort-tab-active": matchSort() === "distance" }} onClick={() => handleSortChange("distance")}>Avstånd</button>
                        <button type="button" role="tab" class="matches-sort-tab" classList={{ "matches-sort-tab-active": matchSort() === "recent" }} onClick={() => handleSortChange("recent")}>Senaste</button>
                        <button type="button" role="tab" class="matches-sort-tab" classList={{ "matches-sort-tab-active": matchSort() === "active" }} onClick={() => handleSortChange("active")}>Senast aktiv</button>
                      </div>
                    </div>
                  </div>
                </div>
            </Show>
            {/* Desktop: original toolbar */}
            <Show when={!isMobileViewport()}>
            <div class="matches-toolbar">
              <div class="matches-filter-row">
                <button
                  type="button"
                  class="matches-sort-toggle"
                  onClick={() => {
                    const next = !filterRowVisible();
                    setFilterRowVisible(next);
                    if (typeof localStorage !== "undefined") {
                      localStorage.setItem("matches-filter-visible", String(next));
                    }
                  }}
                  title={filterRowVisible() ? "Dölj kategori" : "Visa kategorier"}
                  aria-expanded={filterRowVisible()}
                >
                  <span class="matches-sort-toggle-label">
                    Visa: {filterLabel()}
                  </span>
                  <span class="matches-sort-toggle-icon" aria-hidden="true">
                    {filterRowVisible() ? "▲" : "▼"}
                  </span>
                </button>
                <Show when={filterRowVisible()}>
                  <div class="matches-filter-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": matchFilter() === "all" }}
                      onClick={() => handleFilterChange("all")}
                    >
                      Alla ({tabCounts().all})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": matchFilter() === "matched" }}
                      onClick={() => handleFilterChange("matched")}
                    >
                      Matchade ({tabCounts().matched})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": matchFilter() === "not_matched" }}
                      onClick={() => handleFilterChange("not_matched")}
                    >
                      Tillgängliga ({tabCounts().not_matched})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": matchFilter() === "outgoing" }}
                      onClick={() => handleFilterChange("outgoing")}
                    >
                      Skickade ({tabCounts().outgoing})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab matches-filter-tab-with-badge"
                      classList={{ "matches-filter-tab-active": matchFilter() === "requested_me" }}
                      onClick={() => handleFilterChange("requested_me")}
                    >
                      <Show
                        when={requestedMeUnseenCount() > 0}
                        fallback={<>Mottagna ({tabCounts().requested_me})</>}
                      >
                        Mottagna
                        <span
                          class="matches-filter-tab-badge"
                          aria-label={`${requestedMeUnseenCount()} nya`}
                        >
                          {requestedMeUnseenCount()}
                        </span>
                      </Show>
                    </button>
                  </div>
                </Show>
              </div>
              <div class="matches-exclude-row">
                <button
                  type="button"
                  class="matches-sort-toggle"
                  onClick={() => {
                    const next = !excludeRowVisible();
                    setExcludeRowVisible(next);
                    if (typeof localStorage !== "undefined") {
                      localStorage.setItem("matches-include-visible", String(next));
                    }
                  }}
                  title={excludeRowVisible() ? "Dölj inkludera" : "Visa inkludera"}
                  aria-expanded={excludeRowVisible()}
                >
                  <span class="matches-sort-toggle-label">
                    Inkludera:{" "}
                    {[
                      !excludeGive() && "Vill bara passa",
                      !excludeMutual() && "Utbytare",
                      !excludeReceive() && "Vill bara få passning",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Alla"}
                  </span>
                  <span class="matches-sort-toggle-icon" aria-hidden="true">
                    {excludeRowVisible() ? "▲" : "▼"}
                  </span>
                </button>
                <Show when={excludeRowVisible()}>
                  <div class="matches-exclude-tabs" role="group">
                    <button
                      type="button"
                      class="matches-exclude-tab"
                      classList={{ "matches-exclude-tab-active": !excludeGive() }}
                      onClick={() => handleExcludeToggle("give")}
                      title="Inkludera de som vill bara passa hundar"
                    >
                      Vill bara passa
                    </button>
                    <button
                      type="button"
                      class="matches-exclude-tab"
                      classList={{ "matches-exclude-tab-active": !excludeMutual() }}
                      onClick={() => handleExcludeToggle("mutual")}
                      title="Inkludera utbytare (behov + kapacitet)"
                    >
                      Utbytare
                    </button>
                    <button
                      type="button"
                      class="matches-exclude-tab"
                      classList={{ "matches-exclude-tab-active": !excludeReceive() }}
                      onClick={() => handleExcludeToggle("receive")}
                      title="Inkludera de som vill bara få passning"
                    >
                      Vill bara få passning
                    </button>
                  </div>
                </Show>
              </div>
              <div class="matches-sort-row">
                <button
                  type="button"
                  class="matches-sort-toggle"
                  onClick={() => {
                    const next = !sortRowVisible();
                    setSortRowVisible(next);
                    if (typeof localStorage !== "undefined") {
                      localStorage.setItem("matches-sort-visible", String(next));
                    }
                  }}
                  title={sortRowVisible() ? "Dölj sortering" : "Visa sortering"}
                  aria-expanded={sortRowVisible()}
                >
                  <span class="matches-sort-toggle-label">
                    Sortering: {matchSort() === "distance" ? "Avstånd" : matchSort() === "recent" ? "Senaste" : "Senast aktiv"}
                  </span>
                  <span class="matches-sort-toggle-icon" aria-hidden="true">
                    {sortRowVisible() ? "▲" : "▼"}
                  </span>
                </button>
                <Show when={sortRowVisible()}>
                  <div class="matches-sort-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      class="matches-sort-tab"
                      classList={{ "matches-sort-tab-active": matchSort() === "distance" }}
                      onClick={() => handleSortChange("distance")}
                    >
                      Avstånd
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-sort-tab"
                      classList={{ "matches-sort-tab-active": matchSort() === "recent" }}
                      onClick={() => handleSortChange("recent")}
                    >
                      Senaste
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-sort-tab"
                      classList={{ "matches-sort-tab-active": matchSort() === "active" }}
                      onClick={() => handleSortChange("active")}
                    >
                      Senast aktiv
                    </button>
                  </div>
                </Show>
              </div>
            </div>
            </Show>
          </Show>
        </div>
        <Show when={data()?.listings && data()!.listings.length > 0}>
          <div class="matches-mobile-toggle" aria-hidden="true">
            <button
              type="button"
              class="matches-view-toggle-btn"
              classList={{ "matches-view-toggle-active": mobileViewMode() === "list" }}
              onClick={() => setMobileViewMode("list")}
            >
              Lista
            </button>
            <button
              type="button"
              class="matches-view-toggle-btn"
              classList={{ "matches-view-toggle-active": mobileViewMode() === "map" }}
              onClick={() => setMobileViewMode("map")}
            >
              Karta
            </button>
          </div>
        </Show>
        </div>
        <Show when={data()?.listings && data()!.listings.length > 0}>
          <div
            class="matches-split"
            classList={{
              "matches-split-list-only": mobileViewMode() === "list",
              "matches-split-map-only": mobileViewMode() === "map",
            }}
          >
            <div class="matches-map-panel">
              <Show when={!isMobileViewport() || mobileViewMode() === "map"}>
              <MatchesMap
                listings={matchFilteredListings()}
                mutualUserIds={(id) => isMutual(id)}
                requestedMeUserIds={requestedMeUserIds()}
                myLat={pb.authStore.model?.latitude}
                myLon={pb.authStore.model?.longitude}
                filterByBounds
                onBoundsChange={setMapBounds}
                selectedUserId={undefined}
                hoveredUserId={!isMobileViewport() ? hoveredUserId() : undefined}
                baseUrl={baseUrl}
                style={{ height: "100%", "min-height": "400px" }}
              />
              </Show>
            </div>
            <div class="matches-list-panel" ref={(el) => (listContainerRef = el)}>
              <Show when={filteredListings().length === 0} fallback={null}>
                <div class="matches-empty-state">
                  <p style="color: var(--color-text-muted); margin: 0;">
                    {matchFilter() === "outgoing"
                      ? 'Du har inte skickat några förfrågningar än. Bläddra bland Alla eller Tillgängliga och klicka på "Jag är intresserad" för att koppla ihop.'
                      : matchFilter() === "requested_me"
                        ? "Ingen har skickat förfrågan till dig än."
                        : matchFilter() === "matched"
                          ? 'Du har inga matchningar än. När ni båda klickar "Jag är intresserad" blir ni matchade.'
                          : "Ingen att visa i denna vy. Prova att zooma ut på kartan eller byt filter."}
                  </p>
                </div>
              </Show>
              <Show when={filteredListings().length > 0}>
                <MatchCards
                  listings={filteredListings()}
                  baseUrl={baseUrl}
                  getConnections={() => (data()?.connections ?? []) as Conn[]}
                  dateStr={dateStr}
                  sizesStr={sizesStr}
                  onOpenDetail={handleOpenDetail}
                  onCardHover={!isMobileViewport() ? setHoveredUserId : undefined}
                />
              </Show>
            </div>
          </div>
          <div class="container matches-footer-note-container">
            <p style="font-size: 0.875rem; color: var(--color-text-muted); margin-top: 0;">
              Zooma in för att filtrera. Klicka på ett kort eller en markör för att se detaljer.
            </p>
          </div>
        </Show>
      </div>
      <Show when={interestModalTarget()}>
        {(target) => (
          <InterestModal
            target={target()}
            message={interestModalMessage()}
            onMessageChange={setInterestModalMessage}
            onClose={closeInterestModal}
            onSubmit={submitInterestModal}
            loading={refreshing()}
            isVerified={isUserVerified()}
          />
        )}
      </Show>
      <Show when={respondModalTarget()}>
        {(target) => (
          <RespondModal
            target={target()}
            message={respondModalMessage()}
            onMessageChange={setRespondModalMessage}
            onClose={closeRespondModal}
            onAccept={handleAcceptWithReply}
            onReject={handleRejectRequest}
            loading={refreshing()}
            isVerified={isUserVerified()}
          />
        )}
      </Show>
    </AppShell>
  );
}
