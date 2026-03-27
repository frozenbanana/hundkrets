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
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isUserVerified } from "~/lib/auth";
import { findListings } from "~/lib/matching";
import { approximateCoords, pointInBounds, type MapBounds } from "~/lib/geocode";
import { AppShell } from "~/components/AppShell";
import { MatchesMap } from "~/components/MatchesMap";
import { MatchCards } from "./explore/MatchCard";
import { InterestModal } from "./explore/InterestModal";
import { RespondModal } from "./explore/RespondModal";
import type { Conn } from "./explore/types";
import {
  DEFAULT_MAX_DISTANCE_KM,
  DISTANCE_STEPS_KM,
  dateStr,
  sizesStr,
  filterFromParams,
  buildMatchesUrl,
  buildMatchesParams,
  getExchangeType,
  type MatchFilter,
  type MatchSort,
} from "./explore/helpers";

type UpcomingExcursion = {
  id: string;
  title: string;
  start_at: string;
  meeting_area: string;
};

export default function Matches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = createSignal(false);
  const [matchFilter, setMatchFilter] = createSignal<MatchFilter>("all");
  const [excludeGive, setExcludeGive] = createSignal(false);
  const [excludeMutual, setExcludeMutual] = createSignal(false);
  const [excludeReceive, setExcludeReceive] = createSignal(false);
  const [matchSort, setMatchSort] = createSignal<MatchSort>("active");
  const [mobileFilterOpen, setMobileFilterOpen] = createSignal(
    typeof window !== "undefined" && !window.matchMedia("(max-width: 768px)").matches
  );
  const [hoveredUserId, setHoveredUserId] = createSignal<string | undefined>(undefined);

  const [introDismissed, setIntroDismissed] = createSignal(
    typeof window !== "undefined" && localStorage.getItem("matches-intro-dismissed") === "true"
  );

  const [maxDistanceKm, setMaxDistanceKm] = createSignal(DEFAULT_MAX_DISTANCE_KM);

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

  const isMobileMapView = () => isMobileViewport() && mobileViewMode() === "map" && (listings().length ?? 0) > 0;

  createEffect(() => {
    const shouldDisable = isMobileMapView();
    if (shouldDisable && typeof document !== "undefined") {
      document.body.classList.add("matches-map-view-no-scroll");
    }
    onCleanup(() => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("matches-map-view-no-scroll");
      }
    });
  });

  onCleanup(() => {
    if (typeof document !== "undefined") {
      document.body.classList.remove("matches-map-view-no-scroll");
    }
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
        const usersArr = users as {
          id: string;
          latitude?: number;
          longitude?: number;
          [k: string]: unknown;
        }[];
        const needsArr = needs as { user: string; dog: string; [k: string]: unknown }[];
        const capacitiesArr = capacities as { user: string; [k: string]: unknown }[];
        const dogsArr = dogs as { id: string; owner: string; [k: string]: unknown }[];
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
        return {
          needs: needsArr,
          capacities: capacitiesArr,
          users: usersArr,
          dogs: dogsArr,
          connections: normalizedConnections,
          myNeeds,
          myCapacities,
        };
      } catch (err) {
        const e = err as { status?: number; message?: string; url?: string };
        console.error("Matches fetch failed:", e?.status, e?.message, e?.url);
        throw err;
      }
    }
  );

  const [upcomingExcursions] = createResource(async () => {
    try {
      const nowIso = new Date().toISOString();
      const list = await pb.collection("excursions").getFullList<UpcomingExcursion & { status?: string }>({
        filter: `status = "scheduled" && start_at >= "${nowIso}"`,
        sort: "start_at",
      });
      return list.slice(0, 3);
    } catch (err) {
      console.warn("[explore] upcoming excursions fetch failed", err);
      return [] as UpcomingExcursion[];
    }
  });

  const listings = createMemo(() => {
    const d = data();
    const userId = pb.authStore.model?.id;
    if (!d || !userId) return [];
    const { needs, capacities, users, dogs, connections } = d;
    const dist = maxDistanceKm();
    const baseListings = findListings(
      needs as Parameters<typeof findListings>[0],
      capacities as Parameters<typeof findListings>[1],
      userId,
      users as Parameters<typeof findListings>[3],
      dogs as Parameters<typeof findListings>[4],
      dist
    );
    const connFrom = (c: { from_user?: unknown }) =>
      typeof (c.from_user as { id?: string })?.id === "string"
        ? (c.from_user as { id: string }).id
        : typeof c.from_user === "string"
          ? c.from_user
          : "";
    const connTo = (c: { to_user?: unknown }) =>
      typeof (c.to_user as { id?: string })?.id === "string"
        ? (c.to_user as { id: string }).id
        : typeof c.to_user === "string"
          ? c.to_user
          : "";
    const listingUserIds = new Set(baseListings.map((l) => l.user.id));
    const requestedMeIds = connections
      .filter((c: { to_user?: unknown }) => connTo(c) === userId)
      .map((c: { from_user?: unknown }) => connFrom(c));
    const outgoingIds = connections
      .filter(
        (c: { from_user?: unknown; to_user?: unknown }) =>
          connFrom(c) === userId &&
          !connections.some(
            (r: { from_user?: unknown; to_user?: unknown }) =>
              connFrom(r) === connTo(c) && connTo(r) === userId
          )
      )
      .map((c: { to_user?: unknown }) => connTo(c));
    const needsByUser = new Map<string, typeof needs>();
    for (const n of needs) {
      if (!needsByUser.has(n.user)) needsByUser.set(n.user, []);
      needsByUser.get(n.user)!.push(n);
    }
    const capacitiesByUser = new Map<string, typeof capacities>();
    for (const c of capacities) {
      if (!capacitiesByUser.has(c.user)) capacitiesByUser.set(c.user, []);
      capacitiesByUser.get(c.user)!.push(c);
    }
    const dogMap = new Map(dogs.map((d) => [d.id, d]));
    const extraListings: typeof baseListings = [];
    const addExtraListing = (uid: string) => {
      if (listingUserIds.has(uid)) return;
      const user = users.find((u) => u.id === uid);
      if (!user) return;
      const userNeeds = needsByUser.get(uid) ?? [];
      const userCapacities = capacitiesByUser.get(uid) ?? [];
      const userDogIds = new Set(userNeeds.flatMap((n) => Array.isArray(n.dog) ? n.dog : n.dog ? [n.dog] : []));
      const userDogs = [...userDogIds]
        .map((id) => dogMap.get(id))
        .filter(Boolean) as typeof dogs;
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
    return [...baseListings, ...extraListings].sort(
      (a, b) =>
        ((a as { distanceKm?: number }).distanceKm ?? 999) -
        ((b as { distanceKm?: number }).distanceKm ?? 999)
    );
  });

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
    navigate(`/users/${userId}?from=explore`);
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

  const hasNeedsAndCapacity = createMemo(() => {
    const d = data();
    if (!d) return false;
    return d.myNeeds.length > 0 || d.myCapacities.length > 0;
  });

  const userTypeInfo = createMemo(() => {
    const d = data();
    const userModel = pb.authStore.model as { user_type?: string } | null;
    if (!d) return { isSitterOnly: false, isReceiverOnly: false };
    const myDogs = d.dogs.filter((dog) => dog.owner === pb.authStore.model?.id);
    const userType = userModel?.user_type;
    const isSitterOnly = userType === "sitter_only" || (userType == null && myDogs.length === 0);
    const isReceiverOnly =
      userType === "receiver_only" ||
      (userType == null && myDogs.length > 0 && d.myNeeds.length > 0 && d.myCapacities.length === 0);
    return { isSitterOnly, isReceiverOnly };
  });

  const hasCoordinates = () =>
    typeof pb.authStore.model?.latitude === "number" && typeof pb.authStore.model?.longitude === "number";

  const nextDistanceStep = createMemo(() => {
    const current = maxDistanceKm();
    const idx = DISTANCE_STEPS_KM.indexOf(current);
    if (idx < 0 || idx >= DISTANCE_STEPS_KM.length - 1) return null;
    return DISTANCE_STEPS_KM[idx + 1];
  });

  function handleIncreaseDistance() {
    const next = nextDistanceStep();
    if (next) setMaxDistanceKm(next);
  }

  async function handleShareProfile() {
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    const base = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "https://hundkrets.se");
    const url = `${base}/users/${userId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Länken till din profil har kopierats. Redo att dela.");
      navigate(`/users/${userId}?from=explore`);
    } catch {
      showToast("Kunde inte kopiera länken.", "error");
      navigate(`/users/${userId}?from=explore`);
    }
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
    const list = listings();
    const requestedMe = requestedMeUserIds();
    const outgoing = outgoingUserIds();
    return {
      all: list.length,
      matched: list.filter((l) => isMutual(l.user.id)).length,
      not_matched: list.filter((l) => !isMutual(l.user.id)).length,
      outgoing: list.filter((l) => outgoing.has(l.user.id)).length,
      requested_me: list.filter((l) => requestedMe.has(l.user.id)).length,
    };
  });

  const matchFilteredListings = createMemo(() => {
    let list = listings();
    const filter = matchFilter();
    if (filter === "matched") list = list.filter((l) => isMutual(l.user.id));
    else if (filter === "not_matched") list = list.filter((l) => !isMutual(l.user.id));
    else if (filter === "requested_me")
      list = list.filter((l) => requestedMeUserIds().has(l.user.id));
    else if (filter === "outgoing")
      list = list.filter((l) => outgoingUserIds().has(l.user.id));

    if (excludeGive()) list = list.filter((l) => getExchangeType(l) !== "give");
    if (excludeMutual()) list = list.filter((l) => getExchangeType(l) !== "mutual");
    if (excludeReceive()) list = list.filter((l) => getExchangeType(l) !== "receive");

    const sort = matchSort();
    if (sort === "recent") {
      list = [...list].sort((a, b) => {
        const aC = (a.user as { created?: string }).created ?? "";
        const bC = (b.user as { created?: string }).created ?? "";
        return bC.localeCompare(aC);
      });
    } else if (sort === "active") {
      list = [...list].sort((a, b) => {
        const aL = (a.user as { last_login_at?: string }).last_login_at;
        const bL = (b.user as { last_login_at?: string }).last_login_at;
        if (!aL && !bL) return 0;
        if (!aL) return 1;
        if (!bL) return -1;
        return bL.localeCompare(aL);
      });
    } else {
      list = [...list].sort(
        (a, b) =>
          ((a as { distanceKm?: number }).distanceKm ?? 999) -
          ((b as { distanceKm?: number }).distanceKm ?? 999)
      );
    }
    return list;
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
      <div
        class="matches-page"
        classList={{ "matches-page-map-view": isMobileMapView() }}
      >
        <div class="matches-sticky-header">
        <div class="container matches-header-container">
          <Show when={!introDismissed() && (!isMobileViewport() || listings().length === 0)}>
            <div class="page-hero">
              <div class="matches-intro-box">
                <h1>Utforska</h1>
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
          <Show when={(upcomingExcursions() ?? []).length > 0}>
            <div class="card" style="padding: 0.9rem; margin-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div>
                  <h3 style="margin: 0;">Kommande hundträffar</h3>
                  <p style="margin: 0.25rem 0 0; color: var(--color-text-muted); font-size: 0.92rem;">
                    Nya sociala promenader i nätverket.
                  </p>
                </div>
                <A href="/app/excursions" class="btn btn-secondary">
                  Alla hundträffar
                </A>
              </div>
              <div style="display: grid; gap: 0.5rem; margin-top: 0.7rem;">
                <For each={upcomingExcursions()}>
                  {(trip) => (
                    <A href="/app/excursions" class="card" style="padding: 0.55rem; text-decoration: none;">
                      <strong>{trip.title}</strong>
                      <div style="font-size: 0.85rem; color: var(--color-text-muted);">
                        {dateStr(trip.start_at)} - {trip.meeting_area}
                      </div>
                    </A>
                  )}
                </For>
              </div>
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
          <Show when={listings().length === 0 && !data.loading && pb.authStore.model?.area && !hasNeedsAndCapacity()}>
            <p>
              {userTypeInfo().isSitterOnly
                ? "Ingen i ditt område än. Lägg till din tillgänglighet så att hundägare kan hitta dig."
                : userTypeInfo().isReceiverOnly
                  ? "Ingen i ditt område än. Lägg till dina behov så att hundpassare kan hitta dig."
                  : "Ingen i ditt område än. Lägg till dina behov och kapacitet så att andra kan hitta dig."}
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <Show when={!userTypeInfo().isSitterOnly}>
                <A href="/app/needs" class="btn">
                  Lägg till behov
                </A>
              </Show>
              <Show when={!userTypeInfo().isReceiverOnly}>
                <A href="/app/capacity" class="btn btn-secondary">
                  Lägg till kapacitet
                </A>
              </Show>
            </div>
          </Show>
          <Show when={listings().length === 0 && !data.loading && pb.authStore.model?.area && hasNeedsAndCapacity()}>
            <div class="matches-too-far-empty">
              <p>
                Det finns ingen att matcha med inom {maxDistanceKm()} km. Du kan:
              </p>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
                <Show when={hasCoordinates() && nextDistanceStep()} fallback={null}>
                  <button type="button" class="btn" onClick={handleIncreaseDistance}>
                    Öka distansen till {nextDistanceStep()} km
                  </button>
                </Show>
                <button type="button" class="btn btn-secondary" onClick={handleShareProfile}>
                  Dela din profil
                </button>
              </div>
            </div>
          </Show>
          <Show when={listings().length > 0}>
            {/* Utforska header + filter (mobile & desktop) */}
            <div class="matches-explore-header">
                <h1 class="matches-explore-title">Utforska</h1>
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
              class="matches-filter-section"
              classList={{ "matches-filter-section-open": mobileFilterOpen() }}
            >
              <div class="matches-filter-header">
                <span class="matches-filter-title">Filter</span>
                <button
                  type="button"
                  class="matches-filter-clear"
                      onClick={handleClearFilters}
                    >
                  Rensa
                </button>
              </div>
              <div class="matches-filter-content">
                <div class="matches-filter-group">
                  <span class="matches-filter-label">Kategori</span>
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
                <div class="matches-filter-group">
                  <span class="matches-filter-label">Inkludera</span>
                      <div class="matches-filter-tabs" role="group">
                        <button type="button" class="matches-filter-tab" classList={{ "matches-filter-tab-active": !excludeGive() }} onClick={() => handleExcludeToggle("give")} title="Inkludera de som vill bara passa hundar">Vill bara passa</button>
                        <button type="button" class="matches-filter-tab" classList={{ "matches-filter-tab-active": !excludeMutual() }} onClick={() => handleExcludeToggle("mutual")} title="Inkludera utbytare">Utbytare</button>
                        <button type="button" class="matches-filter-tab" classList={{ "matches-filter-tab-active": !excludeReceive() }} onClick={() => handleExcludeToggle("receive")} title="Inkludera de som vill bara få passning">Vill bara få passning</button>
                      </div>
                </div>
                <div class="matches-filter-group">
                  <span class="matches-filter-label">Sortera</span>
                      <div class="matches-filter-tabs" role="tablist">
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchSort() === "distance" }} onClick={() => handleSortChange("distance")}>Avstånd</button>
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchSort() === "recent" }} onClick={() => handleSortChange("recent")}>Senaste</button>
                        <button type="button" role="tab" class="matches-filter-tab" classList={{ "matches-filter-tab-active": matchSort() === "active" }} onClick={() => handleSortChange("active")}>Senast aktiv</button>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </div>
        <Show when={listings().length > 0}>
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
        <Show when={listings().length > 0}>
          <div class="matches-split-wrap">
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
                  <Show when={matchFilter() === "matched" || (searchParams as { match?: string }).match === "true"}>
                    <button
                      type="button"
                      class="btn btn-secondary"
                      style="margin-top: 0.75rem;"
                      onClick={handleClearFilters}
                    >
                      Återställ filter
                    </button>
                  </Show>
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
