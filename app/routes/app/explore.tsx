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
import { haversineDistance } from "~/lib/matching";
import { approximateCoords, pointInBounds, type MapBounds } from "~/lib/geocode";
import { EXCURSION_VISIBILITY_LABELS, excursionPreviewCoords } from "~/lib/excursionListCard";
import { fetchExploreExcursions, type ExploreExcursionItem } from "~/lib/exploreExcursions";
import { AppShell } from "~/components/AppShell";
import { trackUmami } from "~/lib/analytics";
import { ExcursionListCard } from "~/components/ExcursionListCard";
import { ExcursionsMap } from "~/components/ExcursionsMap";
import { MatchesMap } from "~/components/MatchesMap";
import { MediaCard } from "~/components/MediaCard";
import { MediaUploadSheet } from "~/components/MediaUploadSheet";
import { InviteNeighborButton } from "~/components/InviteNeighborButton";
import { fetchLatestMediaByOwners, type MediaRecord } from "~/lib/media";
import { InterestModal } from "./explore/InterestModal";
import { RespondModal } from "./explore/RespondModal";
import type { Conn } from "./explore/types";
import {
  DEFAULT_MAX_DISTANCE_KM,
  DISTANCE_STEPS_KM,
  filterFromParams,
  buildMatchesUrl,
  buildMatchesParams,
  getExchangeType,
  type MatchFilter,
  type MatchSort,
} from "./explore/helpers";

const EXCURSION_DURATION_STEPS = [1, 2, 3, 4, 6, 8] as const;
type ExcursionDateFilter = "all" | "upcoming" | "this_week";
const EXPLORE_EXCURSIONS_SEEN_AT_KEY = "explore-hundtraffar-seen-at";

function normalizedExcursionDuration(ex: ExploreExcursionItem): number {
  const raw = ex.duration_hours;
  const d =
    typeof raw === "string"
      ? Number(raw)
      : typeof raw === "number"
        ? raw
        : Number.NaN;
  if (
    !Number.isNaN(d) &&
    (EXCURSION_DURATION_STEPS as readonly number[]).includes(d)
  ) {
    return d;
  }
  return 2;
}

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
  const [nextActionDismissed, setNextActionDismissed] = createSignal(
    typeof window !== "undefined" && localStorage.getItem("explore-next-action-dismissed") === "true"
  );

  const [maxDistanceKm, setMaxDistanceKm] = createSignal(DEFAULT_MAX_DISTANCE_KM);

  type ExploreMode = "flode" | "karta" | "hundtraffar";

  const exploreMode = createMemo((): ExploreMode => {
    const p = searchParams as Record<string, string | undefined>;
    const forcesFlode =
      p.request === "true" ||
      p.request === "1" ||
      p.match === "true" ||
      p.match === "1" ||
      p.not_matched === "true" ||
      p.not_matched === "1" ||
      p.outgoing === "true" ||
      p.outgoing === "1" ||
      Boolean(p.user?.trim());
    if (forcesFlode) return "flode";
    if (p.utforsk === "hundtraffar") return "hundtraffar";
    if (p.utforsk === "karta") return "karta";
    return "flode";
  });

  function setExploreModeTab(next: ExploreMode) {
    if (next === "hundtraffar") {
      markExploreExcursionsSeenNow();
      setSearchParams({ utforsk: "hundtraffar" }, { replace: true });
    } else if (next === "karta") {
      setSearchParams({ utforsk: "karta" }, { replace: true });
    } else {
      const p = new URLSearchParams(window.location.search);
      p.delete("utforsk");
      const qs = p.toString();
      navigate(`/app/explore${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }

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
    if (exploreMode() === "hundtraffar") return;
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
  const [excursionMapBounds, setExcursionMapBounds] = createSignal<MapBounds | null>(null);
  const [mobileViewMode, setMobileViewMode] = createSignal<"list" | "map">("list");
  const [excursionMobileViewMode, setExcursionMobileViewMode] = createSignal<"list" | "map">("list");
  const [excursionFilterOpen, setExcursionFilterOpen] = createSignal(
    typeof window !== "undefined" && !window.matchMedia("(max-width: 768px)").matches
  );
  const [excursionVisPublic, setExcursionVisPublic] = createSignal(true);
  const [excursionVisMatched, setExcursionVisMatched] = createSignal(true);
  const [excursionVisInterested, setExcursionVisInterested] = createSignal(true);
  const [excursionDateFilter, setExcursionDateFilter] = createSignal<ExcursionDateFilter>("all");
  const [excursionDurFilter, setExcursionDurFilter] = createSignal<Set<number>>(
    new Set(EXCURSION_DURATION_STEPS)
  );
  const [hoveredExcursionId, setHoveredExcursionId] = createSignal<string | undefined>(undefined);
  const [exploreExcursionsSeenAt, setExploreExcursionsSeenAt] = createSignal<string>("");
  const [isMobileViewport, setIsMobileViewport] = createSignal(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = () => setIsMobileViewport(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  const isMobileMapView = () => exploreMode() === "karta" && (listings().length ?? 0) > 0;

  const [exploreExcursionsData, { refetch: refetchExploreExcursions }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [] as ExploreExcursionItem[];
      try {
        return await fetchExploreExcursions(pb);
      } catch (err) {
        console.warn("[explore] excursions fetch failed", err);
        return [] as ExploreExcursionItem[];
      }
    }
  );

  function markExploreExcursionsSeenNow() {
    const now = new Date().toISOString();
    setExploreExcursionsSeenAt(now);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(EXPLORE_EXCURSIONS_SEEN_AT_KEY, now);
    }
  }

  onMount(() => {
    if (typeof localStorage === "undefined") return;
    const existing = localStorage.getItem(EXPLORE_EXCURSIONS_SEEN_AT_KEY);
    if (existing) {
      setExploreExcursionsSeenAt(existing);
      return;
    }
    const me = pb.authStore.model as { last_login_at?: string } | null;
    const initialSeenAt = me?.last_login_at || new Date().toISOString();
    localStorage.setItem(EXPLORE_EXCURSIONS_SEEN_AT_KEY, initialSeenAt);
    setExploreExcursionsSeenAt(initialSeenAt);
  });

  function isPastExcursion(startAt: string): boolean {
    const t = new Date(startAt).getTime();
    return !Number.isNaN(t) && t < Date.now();
  }

  function isWithinCurrentWeek(startAt: string): boolean {
    const t = new Date(startAt);
    if (Number.isNaN(t.getTime())) return false;
    const now = new Date();
    const day = now.getDay(); // Sun=0, Mon=1
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return t >= weekStart && t < weekEnd;
  }

  const excursionMetaFiltered = createMemo(() => {
    const list = exploreExcursionsData() ?? [];
    const vp = excursionVisPublic();
    const vm = excursionVisMatched();
    const vi = excursionVisInterested();
    const dateFilter = excursionDateFilter();
    const durs = excursionDurFilter();
    const filtered = list.filter((e) => {
      if (e.visibility === "public" && !vp) return false;
      if (e.visibility === "matched_only" && !vm) return false;
      if (e.visibility === "interested_by_me" && !vi) return false;
      if (!durs.has(normalizedExcursionDuration(e))) return false;
      if (dateFilter === "upcoming" && isPastExcursion(e.start_at)) return false;
      if (dateFilter === "this_week" && !isWithinCurrentWeek(e.start_at)) return false;
      return true;
    });
    // Keep upcoming first, then passed (most recent first among passed).
    return filtered.sort((a, b) => {
      const aTime = new Date(a.start_at).getTime();
      const bTime = new Date(b.start_at).getTime();
      const aPast = isPastExcursion(a.start_at);
      const bPast = isPastExcursion(b.start_at);
      if (aPast !== bPast) return aPast ? 1 : -1;
      if (aPast && bPast) return bTime - aTime;
      return aTime - bTime;
    });
  });

  const excursionListDisplayed = createMemo(() => {
    const list = excursionMetaFiltered();
    if (isMobileViewport() && excursionMobileViewMode() === "list") return list;
    const bounds = excursionMapBounds();
    if (!bounds) return list;
    return list.filter((e) => {
      const c = excursionPreviewCoords(
        e.meeting_latitude,
        e.meeting_longitude,
        e.meeting_map_url
      );
      if (!c) return false;
      return pointInBounds(c.lat, c.lon, bounds);
    });
  });

  const newExcursionsCount = createMemo(() => {
    const seenAt = exploreExcursionsSeenAt();
    if (!seenAt) return 0;
    const seenTs = Date.parse(seenAt);
    if (Number.isNaN(seenTs)) return 0;
    const list = exploreExcursionsData() ?? [];
    return list.filter((e) => {
      const createdOrStartTs = Date.parse((e.created as string | undefined) ?? e.start_at ?? "");
      return !Number.isNaN(createdOrStartTs) && createdOrStartTs > seenTs;
    }).length;
  });

  const isMobileExcursionMapView = () =>
    isMobileViewport() &&
    excursionMobileViewMode() === "map" &&
    (exploreExcursionsData() ?? []).length > 0;

  createEffect(() => {
    const shouldDisable = isMobileMapView() || isMobileExcursionMapView();
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

  const newMembersCount = createMemo(() => {
    const d = data();
    const meId = pb.authStore.model?.id;
    const me = pb.authStore.model as
      | {
          id?: string;
          last_login_at?: string;
          retention_radius?: number;
          latitude?: number;
          longitude?: number;
          area?: string;
          city?: string;
        }
      | null;
    if (!d || !meId || !me?.last_login_at) return 0;
    const since = Date.parse(me.last_login_at);
    if (Number.isNaN(since)) return 0;
    const radiusKm =
      typeof me.retention_radius === "number" && me.retention_radius > 0
        ? me.retention_radius
        : 3;
    const meArea = (me.area ?? "").trim().toLowerCase();
    const meCity = (me.city ?? "").trim().toLowerCase();
    const users = d.users as Array<{
      id: string;
      created?: string;
      latitude?: number;
      longitude?: number;
      area?: string;
      city?: string;
    }>;
    return users.filter((u) => {
      if (u.id === meId) return false;
      const created = Date.parse(u.created ?? "");
      if (Number.isNaN(created) || created <= since) return false;
      if (
        typeof me.latitude === "number" &&
        typeof me.longitude === "number" &&
        typeof u.latitude === "number" &&
        typeof u.longitude === "number"
      ) {
        return haversineDistance(me.latitude, me.longitude, u.latitude, u.longitude) <= radiusKm;
      }
      const userArea = (u.area ?? "").trim().toLowerCase();
      const userCity = (u.city ?? "").trim().toLowerCase();
      if (meArea && userArea && meArea === userArea) return true;
      if (meCity && userCity && meCity === userCity) return true;
      return false;
    }).length;
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
      trackUmami("Interest sent");
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
  const [uploadSheetOpen, setUploadSheetOpen] = createSignal(false);
  const [mediaByOwner, setMediaByOwner] = createSignal<Map<string, MediaRecord>>(new Map());

  createEffect(() => {
    const list = listings();
    if (!list.length) {
      setMediaByOwner(new Map());
      return;
    }
    const ids = list.map((l) => l.user.id).filter(Boolean);
    let cancelled = false;
    fetchLatestMediaByOwners(ids)
      .then((m) => {
        if (!cancelled) setMediaByOwner(m);
      })
      .catch(() => {
        if (!cancelled) setMediaByOwner(new Map());
      });
    onCleanup(() => {
      cancelled = true;
    });
  });

  async function quickInterest(userId: string) {
    try {
      await handleInterested(userId);
    } catch {
      /* toast already shown */
    }
  }

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

  function toggleExcursionVis(which: "public" | "matched" | "interested") {
    if (which === "public") {
      setExcursionVisPublic((v) => {
        if (v && !excursionVisMatched() && !excursionVisInterested()) return true;
        return !v;
      });
    } else if (which === "matched") {
      setExcursionVisMatched((v) => {
        if (v && !excursionVisPublic() && !excursionVisInterested()) return true;
        return !v;
      });
    } else {
      setExcursionVisInterested((v) => {
        if (v && !excursionVisPublic() && !excursionVisMatched()) return true;
        return !v;
      });
    }
  }

  function toggleExcursionDur(h: number) {
    setExcursionDurFilter((prev) => {
      // UX: from "all selected", tapping one selected chip should focus that single duration.
      if (prev.has(h) && prev.size > 1) return new Set([h]);
      const n = new Set(prev);
      if (n.has(h)) {
        if (n.size <= 1) return n;
        n.delete(h);
      } else {
        n.add(h);
      }
      return n;
    });
  }

  function handleClearExcursionFilters() {
    setExcursionVisPublic(true);
    setExcursionVisMatched(true);
    setExcursionVisInterested(true);
    setExcursionDateFilter("all");
    setExcursionDurFilter(new Set(EXCURSION_DURATION_STEPS));
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  function buildExploreBackHref(): string {
    if (typeof window === "undefined") return "/app/explore?utforsk=hundtraffar";
    const params = new URLSearchParams(window.location.search);
    // Keep any active query state, but force hundträffar mode on return.
    params.set("utforsk", "hundtraffar");
    return `/app/explore?${params.toString()}`;
  }

  function excursionDetailHref(id: string): string {
    const params = new URLSearchParams();
    params.set("from", buildExploreBackHref());
    return `/app/excursions/${id}?${params.toString()}`;
  }

  function excursionCreateHref(): string {
    const params = new URLSearchParams();
    params.set("from", buildExploreBackHref());
    return `/app/excursions/create?${params.toString()}`;
  }

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

  const myListingGaps = createMemo(() => {
    const d = data();
    if (!d) return { missingNeeds: false, missingCapacity: false };
    const userType = (pb.authStore.model as { user_type?: string } | null)?.user_type;
    const missingNeeds =
      userType !== "sitter_only" && (d.myNeeds?.length ?? 0) === 0;
    const missingCapacity =
      userType !== "receiver_only" && (d.myCapacities?.length ?? 0) === 0;
    return { missingNeeds, missingCapacity };
  });

  const showNextActionBanner = createMemo(() => {
    if (nextActionDismissed()) return false;
    if (exploreMode() !== "flode") return false;
    if (!data()) return false;
    const counts = tabCounts();
    return counts.outgoing === 0 && counts.not_matched > 0;
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
    if (exploreMode() !== "karta") return listings;
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
        classList={{
          "matches-page-map-view": isMobileMapView() || isMobileExcursionMapView(),
        }}
      >
        <div class="matches-sticky-header">
        <div class="container matches-header-container">
          <div class="explore-title-bar">
            <h1 class="matches-explore-title explore-title-with-mode">
              <span class="explore-title-prefix">Utforska</span>
              <span class="explore-mode-segment" role="tablist" aria-label="Utforska-läge">
                <button
                  type="button"
                  role="tab"
                  class="explore-mode-tab"
                  classList={{
                    "explore-mode-tab-active": exploreMode() === "flode",
                    "explore-mode-tab-with-marker": newMembersCount() > 0,
                  }}
                  aria-selected={exploreMode() === "flode"}
                  onClick={() => setExploreModeTab("flode")}
                >
                  Flöde
                  <Show when={newMembersCount() > 0}>
                    <span class="explore-mode-tab-marker" aria-label={`${newMembersCount()} nya medlemmar`}>
                      ×
                    </span>
                  </Show>
                </button>
                <button
                  type="button"
                  role="tab"
                  class="explore-mode-tab"
                  classList={{ "explore-mode-tab-active": exploreMode() === "karta" }}
                  aria-selected={exploreMode() === "karta"}
                  onClick={() => setExploreModeTab("karta")}
                >
                  Karta
                </button>
                <button
                  type="button"
                  role="tab"
                  class="explore-mode-tab"
                  classList={{
                    "explore-mode-tab-active": exploreMode() === "hundtraffar",
                    "explore-mode-tab-with-marker": newExcursionsCount() > 0,
                  }}
                  aria-selected={exploreMode() === "hundtraffar"}
                  onClick={() => setExploreModeTab("hundtraffar")}
                >
                  Hundträffar
                  <Show when={newExcursionsCount() > 0}>
                    <span class="explore-mode-tab-marker" aria-label={`${newExcursionsCount()} nya hundträffar`}>
                      ×
                    </span>
                  </Show>
                </button>
              </span>
            </h1>
          </div>

          <Show when={(exploreMode() === "flode" || exploreMode() === "karta") && !introDismissed() && (!isMobileViewport() || listings().length === 0)}>
            <div class="page-hero">
              <div class="matches-intro-box">
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
          <Show when={(exploreMode() === "flode" || exploreMode() === "karta") && !pb.authStore.model?.area && !pb.authStore.model?.city}>
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
              (exploreMode() === "flode" || exploreMode() === "karta") &&
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
          <Show
            when={
              (exploreMode() === "flode" || exploreMode() === "karta") &&
              !!pb.authStore.model?.area &&
              (myListingGaps().missingNeeds || myListingGaps().missingCapacity)
            }
          >
            <div class="profile-incomplete-card profile-incomplete-card-subtle">
              <p style="margin: 0 0 0.75rem; color: var(--color-text-muted);">
                {myListingGaps().missingNeeds && myListingGaps().missingCapacity
                  ? "Lägg till när du behöver passning och när du kan passa—då syns du bättre för grannar."
                  : myListingGaps().missingNeeds
                    ? "Lägg till när du behöver passning så andra kan erbjuda hjälp."
                    : "Lägg till när du kan passa hundar så andra hittar dig."}
              </p>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                <Show when={myListingGaps().missingNeeds}>
                  <A href="/app/needs" class="btn btn-secondary">
                    Lägg till behov
                  </A>
                </Show>
                <Show when={myListingGaps().missingCapacity}>
                  <A href="/app/capacity" class="btn btn-secondary">
                    Lägg till kapacitet
                  </A>
                </Show>
              </div>
            </div>
          </Show>
          <Show when={(exploreMode() === "flode" || exploreMode() === "karta") && requestedMeUnseenCount() > 0}>
            <div class="explore-action-banner explore-action-banner-incoming">
              <p class="explore-action-banner-text">
                {requestedMeUnseenCount() === 1
                  ? "1 person vill ha kontakt med dig."
                  : `${requestedMeUnseenCount()} personer vill ha kontakt med dig.`}
              </p>
              <button
                type="button"
                class="btn"
                onClick={() => handleFilterChange("requested_me")}
              >
                Visa mottagna
              </button>
            </div>
          </Show>
          <Show when={showNextActionBanner()}>
            <div class="explore-action-banner">
              <p class="explore-action-banner-text">
                {tabCounts().not_matched === 1
                  ? "1 granne nära dig vill byta hundpassning. Skicka intresse för att komma igång."
                  : `${tabCounts().not_matched} grannar nära dig vill byta hundpassning. Skicka intresse för att komma igång.`}
              </p>
              <div class="explore-action-banner-actions">
                <button
                  type="button"
                  class="btn"
                  onClick={() => handleFilterChange("not_matched")}
                >
                  Visa tillgängliga
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  onClick={() => {
                    setNextActionDismissed(true);
                    if (typeof localStorage !== "undefined") {
                      localStorage.setItem("explore-next-action-dismissed", "true");
                    }
                  }}
                >
                  Dölj
                </button>
              </div>
            </div>
          </Show>
          <Show when={(exploreMode() === "flode" || exploreMode() === "karta") && data.loading && !data()}>
            <p>Laddar...</p>
          </Show>
          <Show when={(exploreMode() === "flode" || exploreMode() === "karta") && data.error}>
            <p style="color: #dc2626;">Kunde inte ladda matchningar: {data.error?.message}</p>
            <p style="color: var(--color-text-muted); font-size: 0.875rem;">
              Kontrollera att PocketBase körs på{" "}
              {import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090"}
            </p>
            <button type="button" class="btn" onClick={() => refetch()}>
              Försök igen
            </button>
          </Show>
          <Show
            when={
              (exploreMode() === "flode" || exploreMode() === "karta") &&
              listings().length === 0 &&
              !data.loading &&
              pb.authStore.model?.area &&
              !hasNeedsAndCapacity()
            }
          >
            <p>
              {userTypeInfo().isSitterOnly
                ? "Ingen i ditt område än. Lägg till din tillgänglighet så att hundägare kan hitta dig."
                : userTypeInfo().isReceiverOnly
                  ? "Ingen i ditt område än. Lägg till dina behov så att hundpassare kan hitta dig."
                  : "Ingen i ditt område än. Lägg till dina behov och kapacitet så att andra kan hitta dig."}
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
              <InviteNeighborButton />
              <Show when={nextDistanceStep()}>
                <button
                  type="button"
                  class="btn btn-secondary"
                  onClick={handleIncreaseDistance}
                >
                  Öka avstånd till {nextDistanceStep()} km
                </button>
              </Show>
              <Show when={!userTypeInfo().isSitterOnly}>
                <A href="/app/needs" class="btn btn-secondary">
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
          <Show
            when={
              (exploreMode() === "flode" || exploreMode() === "karta") &&
              listings().length === 0 &&
              !data.loading &&
              pb.authStore.model?.area &&
              hasNeedsAndCapacity()
            }
          >
            <div class="matches-too-far-empty">
              <p>
                Det finns ingen att matcha med inom {maxDistanceKm()} km. Du kan:
              </p>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
                <InviteNeighborButton />
                <Show when={hasCoordinates() && nextDistanceStep()} fallback={null}>
                  <button type="button" class="btn btn-secondary" onClick={handleIncreaseDistance}>
                    Öka distansen till {nextDistanceStep()} km
                  </button>
                </Show>
                <button type="button" class="btn btn-secondary" onClick={handleShareProfile}>
                  Dela din profil
                </button>
              </div>
            </div>
          </Show>
          <Show when={(exploreMode() === "flode" || exploreMode() === "karta") && listings().length > 0}>
            <div class="flode-chip-row" role="tablist" aria-label="Kategori">
              <button type="button" role="tab" class="flode-chip" classList={{ "flode-chip-active": matchFilter() === "all" }} onClick={() => handleFilterChange("all")}>Alla</button>
              <button type="button" role="tab" class="flode-chip" classList={{ "flode-chip-active": matchFilter() === "matched" }} onClick={() => handleFilterChange("matched")}>Match</button>
              <button type="button" role="tab" class="flode-chip" classList={{ "flode-chip-active": matchFilter() === "not_matched" }} onClick={() => handleFilterChange("not_matched")}>Lediga</button>
              <button type="button" role="tab" class="flode-chip" classList={{ "flode-chip-active": matchFilter() === "outgoing" }} onClick={() => handleFilterChange("outgoing")}>Skickade</button>
              <button type="button" role="tab" class="flode-chip flode-chip-with-badge" classList={{ "flode-chip-active": matchFilter() === "requested_me" }} onClick={() => handleFilterChange("requested_me")}>
                Mottagna
                <Show when={requestedMeUnseenCount() > 0}>
                  <span class="flode-chip-badge">{requestedMeUnseenCount()}</span>
                </Show>
              </button>
              <button
                type="button"
                class="flode-chip flode-chip-filter"
                classList={{ "flode-chip-active": mobileFilterOpen() }}
                onClick={() => setMobileFilterOpen((o) => !o)}
                aria-expanded={mobileFilterOpen()}
              >
                Filtrera
              </button>
            </div>
            <div
              class="matches-filter-section"
              classList={{ "matches-filter-section-open": mobileFilterOpen() }}
            >
              <div class="matches-filter-header">
                <span class="matches-filter-title">Filtrera</span>
                <button type="button" class="matches-filter-clear" onClick={handleClearFilters}>
                  Rensa
                </button>
              </div>
              <div class="matches-filter-content">
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

          <Show when={exploreMode() === "hundtraffar"}>
            <div class="matches-explore-header explore-excursions-filter-header">
              <A href={excursionCreateHref()} class="btn btn-secondary">
                + Ny hundträff
              </A>
              <button
                type="button"
                class="matches-filter-icon-btn"
                classList={{ "matches-filter-icon-active": excursionFilterOpen() }}
                onClick={() => setExcursionFilterOpen((o) => !o)}
                aria-label={excursionFilterOpen() ? "Dölj filter" : "Visa filter"}
                aria-expanded={excursionFilterOpen()}
              >
                <Show
                  when={excursionFilterOpen()}
                  fallback={
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                      role="img"
                    >
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  }
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    role="img"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Show>
              </button>
            </div>
            <div
              class="matches-filter-section"
              classList={{ "matches-filter-section-open": excursionFilterOpen() }}
            >
              <div class="matches-filter-header">
                <span class="matches-filter-title">Filter</span>
                <button type="button" class="matches-filter-clear" onClick={handleClearExcursionFilters}>
                  Rensa
                </button>
              </div>
              <div class="matches-filter-content">
                <div class="matches-filter-group">
                  <span class="matches-filter-label">Synlighet</span>
                  <div class="matches-filter-tabs" role="group">
                    <button
                      type="button"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": excursionVisPublic() }}
                      onClick={() => toggleExcursionVis("public")}
                    >
                      {EXCURSION_VISIBILITY_LABELS.public}
                    </button>
                    <button
                      type="button"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": excursionVisMatched() }}
                      onClick={() => toggleExcursionVis("matched")}
                    >
                      {EXCURSION_VISIBILITY_LABELS.matched_only}
                    </button>
                    <button
                      type="button"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": excursionVisInterested() }}
                      onClick={() => toggleExcursionVis("interested")}
                    >
                      {EXCURSION_VISIBILITY_LABELS.interested_by_me}
                    </button>
                  </div>
                </div>
                <div class="matches-filter-group">
                  <span class="matches-filter-label">Datum</span>
                  <div class="matches-filter-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": excursionDateFilter() === "all" }}
                      onClick={() => setExcursionDateFilter("all")}
                    >
                      Alla
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": excursionDateFilter() === "upcoming" }}
                      onClick={() => setExcursionDateFilter("upcoming")}
                    >
                      Kommande
                    </button>
                    <button
                      type="button"
                      role="tab"
                      class="matches-filter-tab"
                      classList={{ "matches-filter-tab-active": excursionDateFilter() === "this_week" }}
                      onClick={() => setExcursionDateFilter("this_week")}
                    >
                      Denna veckan
                    </button>
                  </div>
                </div>
                <div class="matches-filter-group">
                  <span class="matches-filter-label">Längd (timmar)</span>
                  <div class="matches-filter-tabs" role="group">
                    <For each={[...EXCURSION_DURATION_STEPS]}>
                      {(h) => (
                        <button
                          type="button"
                          class="matches-filter-tab"
                          classList={{ "matches-filter-tab-active": excursionDurFilter().has(h) }}
                          onClick={() => toggleExcursionDur(h)}
                        >
                          {h} h
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>
            <Show when={exploreExcursionsData.loading}>
              <p>Laddar hundträffar...</p>
            </Show>
            <Show when={exploreExcursionsData.error}>
              <p style="color: #dc2626;">Kunde inte ladda hundträffar.</p>
              <button type="button" class="btn btn-secondary" onClick={() => refetchExploreExcursions()}>
                Försök igen
              </button>
            </Show>
          </Show>
        </div>
        </div>
        <Show when={exploreMode() === "flode"}>
          <div class="container flode-feed">
            <Show when={filteredListings().length === 0}>
              <div class="matches-empty-state">
                <Show
                  when={
                    matchFilter() !== "outgoing" &&
                    matchFilter() !== "requested_me" &&
                    matchFilter() !== "matched"
                  }
                  fallback={
                    <div class="flode-empty-upload card">
                      <p class="flode-empty-upload-title">
                        {matchFilter() === "outgoing"
                          ? "Inga skickade förfrågningar"
                          : matchFilter() === "requested_me"
                            ? "Inga mottagna förfrågningar"
                            : "Inga matchningar än"}
                      </p>
                      <p class="flode-empty-upload-text">
                        {matchFilter() === "outgoing"
                          ? "Bläddra bland lediga grannar och tryck Intresse för att koppla ihop."
                          : matchFilter() === "requested_me"
                            ? "Ingen har skickat förfrågan till dig än."
                            : "När ni båda visar intresse blir ni matchade."}
                      </p>
                      <div class="flode-empty-actions">
                        <button
                          type="button"
                          class="btn"
                          onClick={() => handleFilterChange("not_matched")}
                        >
                          Visa lediga
                        </button>
                        <InviteNeighborButton variant="secondary" />
                      </div>
                    </div>
                  }
                >
                  <div class="flode-empty-upload card">
                    <p class="flode-empty-upload-title">Inga grannar att visa här</p>
                    <p class="flode-empty-upload-text">
                      Bjud in en hundägare i närheten — ju fler lokalt, desto lättare att byta passning.
                    </p>
                    <div class="flode-empty-actions">
                      <InviteNeighborButton />
                      <Show when={nextDistanceStep()}>
                        <button
                          type="button"
                          class="btn btn-secondary"
                          onClick={handleIncreaseDistance}
                        >
                          Öka avstånd till {nextDistanceStep()} km
                        </button>
                      </Show>
                      <button
                        type="button"
                        class="btn btn-secondary"
                        onClick={() => setUploadSheetOpen(true)}
                        data-umami-event="Flode empty upload CTA"
                      >
                        Ladda upp video
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
            <Show when={filteredListings().length > 0}>
              <div class="flode-grid">
                <For each={filteredListings()}>
                  {(listing) => (
                    <MediaCard
                      listing={listing}
                      baseUrl={baseUrl}
                      media={mediaByOwner().get(listing.user.id)}
                      getConnections={() => (data()?.connections ?? []) as Conn[]}
                      onOpenProfile={handleOpenDetail}
                      onQuickInterest={quickInterest}
                      onInterestWithMessage={openInterestModal}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
          <button
            type="button"
            class="media-fab"
            aria-label="Ladda upp video"
            title="Ladda upp video"
            onClick={() => setUploadSheetOpen(true)}
            data-umami-event="Open media upload"
          >
            +
          </button>
          <MediaUploadSheet
            open={uploadSheetOpen()}
            onClose={() => setUploadSheetOpen(false)}
            onUploaded={() => {
              const ids = listings().map((l) => l.user.id);
              fetchLatestMediaByOwners(ids).then(setMediaByOwner).catch(() => {});
            }}
          />
        </Show>
        <Show when={exploreMode() === "karta" && listings().length > 0}>
          <div class="matches-split-wrap matches-map-only-wrap">
            <div class="matches-split matches-split-map-only">
              <div class="matches-map-panel matches-map-panel-full">
                <MatchesMap
                  listings={matchFilteredListings()}
                  mutualUserIds={(id) => isMutual(id)}
                  requestedMeUserIds={requestedMeUserIds()}
                  myLat={pb.authStore.model?.latitude}
                  myLon={pb.authStore.model?.longitude}
                  filterByBounds
                  onBoundsChange={setMapBounds}
                  selectedUserId={undefined}
                  latestMediaByOwner={mediaByOwner()}
                  baseUrl={baseUrl}
                  style={{ height: "100%", "min-height": "70vh", "margin-top": "0", "border-radius": "0" }}
                />
              </div>
            </div>
          </div>
        </Show>
        <Show when={exploreMode() === "hundtraffar" && !exploreExcursionsData.loading && !exploreExcursionsData.error}>
          <div class="matches-mobile-toggle" aria-hidden="true">
            <button
              type="button"
              class="matches-view-toggle-btn"
              classList={{ "matches-view-toggle-active": excursionMobileViewMode() === "list" }}
              onClick={() => setExcursionMobileViewMode("list")}
            >
              Lista
            </button>
            <button
              type="button"
              class="matches-view-toggle-btn"
              classList={{ "matches-view-toggle-active": excursionMobileViewMode() === "map" }}
              onClick={() => setExcursionMobileViewMode("map")}
            >
              Karta
            </button>
          </div>
          <div class="matches-split-wrap">
            <div
              class="matches-split explore-excursions-split"
              classList={{
                "matches-split-list-only": excursionMobileViewMode() === "list",
                "matches-split-map-only": excursionMobileViewMode() === "map",
              }}
            >
              <div class="matches-map-panel">
                <Show when={!isMobileViewport() || excursionMobileViewMode() === "map"}>
                  <ExcursionsMap
                    excursions={excursionMetaFiltered()}
                    myLat={pb.authStore.model?.latitude}
                    myLon={pb.authStore.model?.longitude}
                    hoveredExcursionId={!isMobileViewport() ? hoveredExcursionId() : undefined}
                    filterByBounds
                    onBoundsChange={setExcursionMapBounds}
                    style={{ height: "100%", "min-height": "400px", "margin-top": "0" }}
                  />
                </Show>
              </div>
              <div class="matches-list-panel">
                <Show when={excursionListDisplayed().length === 0} fallback={null}>
                  <div class="matches-empty-state">
                    <p style="color: var(--color-text-muted); margin: 0;">
                      {excursionMetaFiltered().length === 0
                        ? "Inga hundträffar just nu. Skapa en promenad eller träff i ditt område."
                        : "Ingen träff i kartans utsnitt. Zooma ut eller flytta kartan."}
                    </p>
                    <Show when={excursionMetaFiltered().length === 0}>
                      <A href={excursionCreateHref()} class="btn" style="margin-top: 0.75rem;">
                        Skapa hundträff
                      </A>
                    </Show>
                  </div>
                </Show>
                <Show when={excursionListDisplayed().length > 0}>
                  <div style="display: grid; gap: 0.75rem;">
                    <For each={excursionListDisplayed()}>
                      {(trip) => (
                        <div classList={{ "excursions-past-card-wrap": isPastExcursion(trip.start_at) }}>
                          <ExcursionListCard
                            id={trip.id}
                            href={excursionDetailHref(trip.id)}
                            title={trip.title}
                            start_at={trip.start_at}
                            meeting_area={trip.meeting_area}
                            duration_hours={normalizedExcursionDuration(trip)}
                            visibility={trip.visibility}
                            interest_count={trip.interest_count}
                            comment_count={trip.comment_count}
                            meeting_latitude={trip.meeting_latitude}
                            meeting_longitude={trip.meeting_longitude}
                            meeting_map_url={trip.meeting_map_url}
                            hideMapThumb={!isMobileViewport()}
                            onHoverChange={!isMobileViewport() ? setHoveredExcursionId : undefined}
                          />
                        </div>
                      )}
                    </For>
                  </div>
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
