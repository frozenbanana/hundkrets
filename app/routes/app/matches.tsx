import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { getRequestsSeenAt, markRequestsSeen, requestsSeenVersion } from "~/lib/requestsSeen";
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { findListings } from "~/lib/matching";
import { approximateCoords, pointInBounds, type MapBounds } from "~/lib/geocode";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import { MatchesMap } from "~/components/MatchesMap";

const DEFAULT_MAX_DISTANCE_KM = 100;

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function dateStr(n: {
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  start_date?: string;
  end_date?: string;
}) {
  if (!n.flexible_dates && n.start_date && n.end_date) {
    return `${formatDate(n.start_date)} – ${formatDate(n.end_date)}`;
  }
  if (n.flexible_dates) {
    if (n.open_any_duration !== false) return "Flexibel, valfri längd";
    return n.duration_specific ? `Flexibel: ${n.duration_specific}` : "Flexibel";
  }
  return "—";
}

const genderLabel: Record<string, string> = { male: "Hane", female: "Hona" };
const sizeLabel: Record<string, string> = { small: "Liten", medium: "Mellan", large: "Stor" };
const temperamentLabel: Record<string, string> = { friendly: "Vänlig", cautious: "Försiktig", shy: "Blyg", reactive: "Reaktiv", neutral: "Neutral", unknown: "Okänd" };

function MatchCard(props: {
  listing: ReturnType<typeof findListings>[number];
  baseUrl: string;
  getConnections: () => { from_user: string; to_user: string }[];
  refreshing: () => boolean;
  onInterested: (id: string) => void;
  onWithdraw?: (userId: string) => void;
  onUnmatch?: (userId: string) => void;
  onSelect?: (userId: string) => void;
  isSelected?: boolean;
  dateStr: (n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
}) {
  const { listing, baseUrl, getConnections, refreshing, onInterested, onWithdraw, onUnmatch, onSelect, isSelected, dateStr, sizesStr } = props;
  const conns = () => getConnections();
  const mutual = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    const c = conns();
    const iReq = c.some((x) => x.from_user === me && x.to_user === listing.user.id);
    const theyReq = c.some((x) => x.from_user === listing.user.id && x.to_user === me);
    return iReq && theyReq;
  };
  const requested = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    return conns().some((x) => x.from_user === me && x.to_user === listing.user.id);
  };
  return (
    <div
      class="card match-card"
      classList={{ "match-card-selected": isSelected }}
      data-listing-id={listing.user.id}
      onClick={() => onSelect?.(listing.user.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.(listing.user.id)}
    >
      {mutual() && (
        <span class="match-card-badge">matchad</span>
      )}
      <div class="dog-card" style="margin-bottom: 1rem;">
        <Avatar
          name={listing.user.name}
          city={listing.user.city}
          neighborhood={listing.user.neighborhood}
          area={listing.user.area}
          id={listing.user.id}
          avatar={listing.user.avatar}
          baseUrl={baseUrl}
          class="dog-card-img"
        />
        <div style="flex: 1;">
          <h3 style="margin: 0;">{listing.user.name || "Okänd"}</h3>
          {listing.dogs.length === 0 && listing.needs.length === 0 && listing.capacities.length > 0 && (
            <p style="color: var(--color-paw); font-size: 0.9rem; font-weight: 600; margin: 0.25rem 0;">
              Vill bara passa hundar – har inte egen hund
            </p>
          )}
          {listing.user.area && (
            <p style="color: var(--color-text-muted); margin: 0.25rem 0;">{listing.user.area}</p>
          )}
          {listing.user.bio && (
            <p style="color: var(--color-text-muted); margin: 0.25rem 0; font-size: 0.9rem;">{listing.user.bio}</p>
          )}
          {listing.user.breeds_owned_before && (
            <p style="color: var(--color-text-muted); margin: 0.25rem 0; font-size: 0.85rem;">Tidigare raser: {listing.user.breeds_owned_before}</p>
          )}
          {"distanceKm" in listing && typeof listing.distanceKm === "number" && (
            <p style="color: var(--color-text-muted); margin: 0.25rem 0; font-size: 0.875rem;">
              ~{Math.round(listing.distanceKm)} km bort
            </p>
          )}
          {listing.capacities.length > 0 && (
            <p style="font-size: 0.9rem; margin: 0.5rem 0 0; color: var(--color-text);">
              <strong>Hundpassarförmåga:</strong>{" "}
              {listing.capacities.map((c) => `${dateStr(c)} • ${sizesStr(c.dog_sizes)} • max ${c.max_dogs}`).join(" · ")}
            </p>
          )}
          {mutual() && listing.user.phone && (
            <p style="margin-top: 0.5rem;">
              <strong>Telefon:</strong> <a href={`tel:${listing.user.phone}`}>{listing.user.phone}</a>
            </p>
          )}
          {mutual() && listing.user.address_private && (
            <p style="margin-top: 0.5rem;">
              <strong>Adress:</strong> {listing.user.address_private}
            </p>
          )}
        </div>
      </div>

      {listing.needs.length > 0 && (
        <div style="margin-bottom: 0.75rem;">
          <strong>Behöver hundpassning:</strong>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
            <For each={listing.needs}>
              {(n) => {
                const dog = listing.dogs.find((d) => d.id === n.dog) as {
                  id?: string;
                  name?: string;
                  breed?: string;
                  size?: string;
                  gender?: string;
                  age?: number;
                  image?: string;
                  notes?: string;
                  temperament_new_people?: string;
                  temperament_new_dogs_female?: string;
                  temperament_new_dogs_male?: string;
                } | undefined;
                const d = dog ?? {};
                return (
                  <div class="need-card">
                    <div class="need-card-image">
                      <DogImage
                        dog={d}
                        baseUrl={baseUrl}
                        class="dog-card-img"
                      />
                    </div>
                    <div class="need-card-content">
                      <strong>{d.name ?? "Hund"}</strong>
                      {d.size && (
                        <p style="margin: 0.25rem 0; font-size: 0.875rem;"><span style="font-weight: 600;">Storlek:</span> {sizeLabel[d.size] ?? d.size}</p>
                      )}
                      {d.breed && (
                        <p style="margin: 0.25rem 0; font-size: 0.875rem;"><span style="font-weight: 600;">Ras:</span> {d.breed}</p>
                      )}
                      {d.gender && (
                        <p style="margin: 0.25rem 0; font-size: 0.875rem;"><span style="font-weight: 600;">Kön:</span> {genderLabel[d.gender] ?? d.gender}</p>
                      )}
                      {d.age != null && (
                        <p style="margin: 0.25rem 0; font-size: 0.875rem;"><span style="font-weight: 600;">Ålder:</span> {d.age} år</p>
                      )}
                      {(d.temperament_new_people || d.temperament_new_dogs_female || d.temperament_new_dogs_male) && (
                        <p style="margin: 0.25rem 0; font-size: 0.875rem; color: var(--color-text-muted);">
                          <span style="font-weight: 600;">Temperament:</span><br /> Nya människor - {temperamentLabel[d.temperament_new_people ?? ""] || d.temperament_new_people || "—"} <br /> Nya hundar (Hona) - {temperamentLabel[d.temperament_new_dogs_female ?? ""] || d.temperament_new_dogs_female || "—"} <br /> Nya hundar (Hane) - {temperamentLabel[d.temperament_new_dogs_male ?? ""] || d.temperament_new_dogs_male || "—"}
                        </p>
                      )}
                      {d.notes && (
                        <p style="margin: 0.25rem 0; font-size: 0.875rem;"><span style="font-weight: 600;">Anteckningar:</span> <br /> {d.notes}</p>
                      )}
                      <p style="margin: 0.5rem 0 0; font-size: 0.875rem;"><span style="font-weight: 600;">Datum:</span> <br /> {dateStr(n)}</p>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      )}
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;" onClick={(e) => e.stopPropagation()}>
        <Show when={!mutual()}>
          {requested() ? (
            <>
              <span class="btn btn-secondary" style="cursor: default;">
                Intresse skickat
              </span>
              <button
                type="button"
                class="btn btn-secondary"
                disabled={refreshing()}
                onClick={() => onWithdraw?.(listing.user.id)}
              >
                Ångra
              </button>
            </>
          ) : (
            <button
              type="button"
              class="btn"
              disabled={refreshing()}
              onClick={() => onInterested(listing.user.id)}
            >
              Jag är intresserad
            </button>
          )}
        </Show>
        <Show when={mutual() && onUnmatch}>
          <button
            type="button"
            class="btn btn-secondary"
            disabled={refreshing()}
            onClick={() => onUnmatch?.(listing.user.id)}
          >
            Avmatcha
          </button>
        </Show>
      </div>
    </div>
  );
}

function MatchCards(props: {
  listings: ReturnType<typeof findListings>;
  baseUrl: string;
  getConnections: () => { from_user: string; to_user: string }[];
  refreshing: () => boolean;
  onInterested: (id: string) => void;
  onWithdraw?: (userId: string) => void;
  onUnmatch?: (userId: string) => void;
  selectedUserId?: string;
  onSelect: (userId: string) => void;
  dateStr: (n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
}) {
  return (
    <div class="match-cards-list">
      <For each={props.listings}>
        {(listing) => (
          <MatchCard
            listing={listing}
            baseUrl={props.baseUrl}
            getConnections={props.getConnections}
            refreshing={props.refreshing}
            onInterested={props.onInterested}
            onWithdraw={props.onWithdraw}
            onUnmatch={props.onUnmatch}
            onSelect={props.onSelect}
            isSelected={props.selectedUserId === listing.user.id}
            dateStr={props.dateStr}
            sizesStr={props.sizesStr}
          />
        )}
      </For>
    </div>
  );
}

function sizesStr(s: string | string[] | undefined) {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  if (arr.length >= 3) return "Alla storlekar";
  return arr.map((x) => sizeLabel[x] ?? x.charAt(0).toUpperCase() + x.slice(1)).join(", ");
}

type MatchFilter = "all" | "matched" | "not_matched" | "requested_me" | "outgoing";

function filterFromParams(params: { match?: string; not_matched?: string; request?: string; outgoing?: string }): MatchFilter {
  if (params.request === "true" || params.request === "1") return "requested_me";
  if (params.outgoing === "true" || params.outgoing === "1") return "outgoing";
  if (params.match === "true" || params.match === "1") return "matched";
  if (params.not_matched === "true" || params.not_matched === "1") return "not_matched";
  return "all";
}

function filterToParams(filter: MatchFilter): Record<string, string> {
  const next: Record<string, string> = {};
  if (filter === "matched") next.match = "true";
  else if (filter === "not_matched") next.not_matched = "true";
  else if (filter === "requested_me") next.request = "true";
  else if (filter === "outgoing") next.outgoing = "true";
  return next;
}

function buildMatchesUrl(filter: MatchFilter, user?: string): string {
  const params = new URLSearchParams();
  const fp = filterToParams(filter);
  for (const [k, v] of Object.entries(fp)) {
    if (v) params.set(k, v);
  }
  if (user) params.set("user", user);
  const qs = params.toString();
  return `/app/matches${qs ? "?" + qs : ""}`;
}

export default function Matches() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = createSignal(false);
  const [matchFilter, setMatchFilter] = createSignal<MatchFilter>(
    filterFromParams(searchParams as { match?: string; not_matched?: string; request?: string; outgoing?: string })
  );

  createEffect(() => {
    const next = filterFromParams(searchParams as { match?: string; not_matched?: string; request?: string; outgoing?: string });
    setMatchFilter(next);
  });
  const [selectedUserId, setSelectedUserId] = createSignal<string | undefined>(
    (searchParams as { user?: string }).user
  );

  createEffect(() => {
    if (typeof window === "undefined") return;
    const filter = matchFilter();
    const params = searchParams as { user?: string };
    const url = buildMatchesUrl(filter, params.user);
    const current = window.location.pathname + (window.location.search || "");
    console.log("[matches] URL sync", { filter, url, current, willNavigate: current !== url });
    if (current !== url) navigate(url, { replace: true });
  });

  createEffect(() => {
    const user = (searchParams as { user?: string }).user;
    if (user) setSelectedUserId(user);
  });

  createEffect(() => {
    if ((searchParams as { request?: string }).request === "true") markRequestsSeen();
  });
  const [mapBounds, setMapBounds] = createSignal<MapBounds | null>(null);
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
          pb.collection("connection_requests").getFullList({ requestKey: "matches-connections" }).catch((err) => {
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
        const connId = (c: unknown) => (typeof (c as { id?: string }).id === "string" ? (c as { id: string }).id : "");
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
        const outgoingIds = connections.filter(
          (c) => connFrom(c) === userId && !connections.some((r) => connFrom(r) === connTo(c) && connTo(r) === userId)
        ).map((c) => connTo(c));
        const usersArr = users as { id: string; latitude?: number; longitude?: number; [k: string]: unknown }[];
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
          const userDogs = [...userDogIds].map((id) => dogMap.get(id)).filter(Boolean) as typeof dogsArr;
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
          (a, b) => ((a as { distanceKm?: number }).distanceKm ?? 999) - ((b as { distanceKm?: number }).distanceKm ?? 999)
        );
        const normalizedConnections = connections.map((c) => ({
          id: connId(c),
          from_user: connFrom(c),
          to_user: connTo(c),
        }));
        return { listings, connections: normalizedConnections };
      } catch (err) {
        const e = err as { status?: number; message?: string; url?: string };
        console.error("Matches fetch failed:", e?.status, e?.message, e?.url);
        throw err;
      }
    }
  );

  async function handleInterested(toUserId: string) {
    const fromUserId = pb.authStore.model?.id;
    if (!fromUserId) return;
    setRefreshing(true);
    try {
      const created = await pb.collection("connection_requests").create({
        from_user: fromUserId,
        to_user: toUserId,
      });
      mutate((prev) => {
        if (!prev) {
          return prev;
        }
        const next = { ...prev, connections: [...prev.connections, created] };
        return next;
      });
    } catch (e) {
      console.error("[matches] handleInterested error", e);
      if ((e as { status?: number })?.status !== 400) console.error(e);
      refetch();
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
        return { ...prev, connections: prev.connections.filter((c: { id: string }) => c.id !== conn.id) };
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleUnmatch(otherUserId: string) {
    const me = pb.authStore.model?.id;
    if (!me || !data()?.connections) return;
    const conns = (data()!.connections as { id?: string; from_user: string; to_user: string }[]).filter(
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
        return { ...prev, connections: prev.connections.filter((c: { id?: string }) => !c.id || !idsToRemove.has(c.id)) };
      });
    } catch (e) {
      console.error("[matches] handleUnmatch error", e);
      refetch();
    } finally {
      setRefreshing(false);
    }
  }


  function isMutual(listingUserId: string): boolean {
    const me = pb.authStore.model?.id;
    const conns = data()?.connections;
    if (!me || !conns) return false;
    const connsArr = conns as { from_user: string; to_user: string }[];
    const iReq = connsArr.some((c) => c.from_user === me && c.to_user === listingUserId);
    const theyReq = connsArr.some((c) => c.from_user === listingUserId && c.to_user === me);
    const result = iReq && theyReq;
    return result;
  }

  function iRequested(listingUserId: string): boolean {
    const me = pb.authStore.model?.id;
    const conns = data()?.connections;
    if (!me || !conns) return false;
    return (conns as { from_user: string; to_user: string }[]).some(
      (c) => c.from_user === me && c.to_user === listingUserId
    );
  }

  function handleSelect(userId: string) {
    setSelectedUserId((prev) => (prev === userId ? undefined : userId));
  }

  function handleFilterChange(filter: MatchFilter) {
    setMatchFilter(filter);
    if (filter === "requested_me") markRequestsSeen();
    const params = searchParams as { user?: string };
    const url = buildMatchesUrl(filter, params.user);
    console.log("[matches] Tab click", { filter, url });
    navigate(url, { replace: true });
  }

  function handleMarkerClick(userId: string) {
    setSelectedUserId(userId);
    const idx = data()?.listings.findIndex((l) => l.user.id === userId);
    if (idx !== undefined && idx >= 0 && listContainerRef) {
      const card = listContainerRef.querySelector(`[data-listing-id="${userId}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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
      const iReq = conns.some((x: { from_user: string; to_user: string }) => x.from_user === me && x.to_user === other);
      const theyReq = conns.some((x: { from_user: string; to_user: string }) => x.from_user === other && x.to_user === me);
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
      const iReq = conns.some((x: { from_user: string; to_user: string }) => x.from_user === me && x.to_user === other);
      const theyReq = conns.some((x: { from_user: string; to_user: string }) => x.from_user === other && x.to_user === me);
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
    const listings = data()?.listings ?? [];
    const filter = matchFilter();
    if (filter === "matched") return listings.filter((l) => isMutual(l.user.id));
    if (filter === "not_matched") return listings.filter((l) => !isMutual(l.user.id));
    if (filter === "requested_me") return listings.filter((l) => requestedMeUserIds().has(l.user.id));
    if (filter === "outgoing") return listings.filter((l) => outgoingUserIds().has(l.user.id));
    return listings;
  });

  const filteredListings = createMemo(() => {
    const listings = matchFilteredListings();
    const bounds = mapBounds();
    if (!bounds) return listings;
    return listings.filter((listing) => {
      const u = listing.user as { id?: string; latitude?: number; longitude?: number };
      if (typeof u.latitude !== "number" || typeof u.longitude !== "number") return false;
      const [lat, lon] = approximateCoords(u.latitude, u.longitude, u.id ?? "");
      return pointInBounds(lat, lon, bounds);
    });
  });

  createEffect(() => {
    const selected = selectedUserId();
    const filtered = filteredListings();
    if (selected && !filtered.some((l) => l.user.id === selected)) {
      setSelectedUserId(undefined);
    }
  });

  return (
    <AppShell>
      <div class="matches-page">
        <div class="container">
          <div class="page-hero">
          <span class="paw-emoji">🐾</span>
          <h1>Matchningar</h1>
          <p style="color: var(--color-text-muted);">
            Hundägare i ditt område som vill byta hundpassning. Klicka "Jag är intresserad" för att koppla ihop—när de gör det samma byter ni telefonnummer och adresser.
          </p>
        </div>
        <Show when={!pb.authStore.model?.area && !pb.authStore.model?.city}>
          <div class="profile-incomplete-card">
            <h3 style="margin: 0 0 0.5rem; color: var(--color-paw-dark);">Profilen behöver uppdateras</h3>
            <p style="margin: 0 0 1rem; color: var(--color-text-muted);">
              Din adress behövs för att hitta hundägare i ditt område. Matchningar visas baserat på närhet—utan adress kan vi inte visa relevanta personer.
            </p>
            <ul class="profile-incomplete-checklist">
              <li style="color: #dc2626;">Adress saknas</li>
              <Show when={!pb.authStore.model?.avatar}>
                <li style="color: var(--color-text-muted);">Profilbild (valfritt)</li>
              </Show>
            </ul>
            <A href="/app/profile" class="btn">Gå till profil och ange adress</A>
          </div>
        </Show>
        <Show when={pb.authStore.model?.area && !pb.authStore.model?.latitude && !pb.authStore.model?.longitude}>
          <div class="profile-incomplete-card profile-incomplete-card-subtle">
            <p style="margin: 0 0 0.75rem; color: var(--color-text-muted);">
              Uppdatera din profil med full adress för att filtrera på avstånd och se kartan.
            </p>
            <A href="/app/profile" class="btn btn-secondary">Uppdatera adress</A>
          </div>
        </Show>
        <Show when={data.loading && !data()}>
          <p>Laddar...</p>
        </Show>
        <Show when={data.error}>
          <p style="color: #dc2626;">
            Kunde inte ladda matchningar: {data.error?.message}
          </p>
          <p style="color: var(--color-text-muted); font-size: 0.875rem;">
            Kontrollera att PocketBase körs på {import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090"}
          </p>
          <button type="button" class="btn" onClick={() => refetch()}>
            Försök igen
          </button>
        </Show>
        <Show when={data()?.listings.length === 0 && !data.loading && pb.authStore.model?.area}>
          <p>Ingen i ditt område än. Lägg till dina behov och kapacitet så att andra kan hitta dig.</p>
          <A href="/app/needs" class="btn">Lägg till behov</A>
          <A href="/app/capacity" class="btn btn-secondary" style="margin-left: 0.5rem;">Lägg till kapacitet</A>
        </Show>
        <Show when={data()?.listings && data()!.listings.length > 0}>
          <div class="matches-toolbar">
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
                Ej matchade ({tabCounts().not_matched})
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
                  <span class="matches-filter-tab-badge" aria-label={`${requestedMeUnseenCount()} nya`}>
                    {requestedMeUnseenCount()}
                  </span>
                </Show>
              </button>
            </div>
          </div>
        </Show>
        </div>
        <Show when={data()?.listings && data()!.listings.length > 0}>
          <div class="matches-split">
            <div class="matches-map-panel">
              <MatchesMap
                listings={matchFilteredListings()}
                mutualUserIds={(id) => isMutual(id)}
                requestedMeUserIds={requestedMeUserIds()}
                myLat={pb.authStore.model?.latitude}
                myLon={pb.authStore.model?.longitude}
                filterByBounds
                onBoundsChange={setMapBounds}
                selectedUserId={selectedUserId()}
                onMarkerClick={handleMarkerClick}
                style={{ height: "100%", "min-height": "400px" }}
              />
            </div>
            <div
              class="matches-list-panel"
              ref={(el) => { listContainerRef = el; }}
            >
              <Show when={filteredListings().length === 0} fallback={null}>
                <div class="matches-empty-state">
                  <p style="color: var(--color-text-muted); margin: 0;">
                    {matchFilter() === "outgoing"
                      ? "Du har inte skickat några förfrågningar än. Bläddra bland Alla eller Ej matchade och klicka på \"Jag är intresserad\" för att koppla ihop."
                      : matchFilter() === "requested_me"
                        ? "Ingen har skickat förfrågan till dig än."
                        : matchFilter() === "matched"
                          ? "Du har inga matchningar än. När ni båda klickar \"Jag är intresserad\" blir ni matchade."
                          : "Ingen att visa i denna vy. Prova att zooma ut på kartan eller byt filter."}
                  </p>
                </div>
              </Show>
              <Show when={filteredListings().length > 0}>
              <MatchCards
                listings={filteredListings()}
                baseUrl={baseUrl}
                getConnections={() => (data()?.connections ?? []) as { from_user: string; to_user: string }[]}
                refreshing={refreshing}
                onInterested={handleInterested}
                onWithdraw={handleWithdraw}
                onUnmatch={handleUnmatch}
                selectedUserId={selectedUserId()}
                onSelect={handleSelect}
                dateStr={dateStr}
                sizesStr={sizesStr}
              />
              </Show>
            </div>
          </div>
          <div class="container">
            <p style="font-size: 0.875rem; color: var(--color-text-muted); margin-top: 0.5rem;">
              Zooma in för att filtrera. Klicka på ett kort eller en markör för att välja.
            </p>
          </div>
        </Show>
      </div>
    </AppShell>
  );
}
