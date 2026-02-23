import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { getRequestsSeenAt, markRequestsSeen, requestsSeenVersion } from "~/lib/requestsSeen";
import { showToast } from "~/lib/toast";
import { createEffect, createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
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

const genderLabel: Record<string, string> = { male: "Hane", female: "Hona", any: "Alla" };
const sizeLabel: Record<string, string> = { small: "Liten", medium: "Mellan", large: "Stor" };

function datesOverlap(
  aStart: string | undefined,
  aEnd: string | undefined,
  bStart: string | undefined,
  bEnd: string | undefined
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  const aS = new Date(aStart).getTime();
  const aE = new Date(aEnd).getTime();
  const bS = new Date(bStart).getTime();
  const bE = new Date(bEnd).getTime();
  if (isNaN(aS) || isNaN(aE) || isNaN(bS) || isNaN(bE)) return false;
  return aS <= bE && bS <= aE;
}
const temperamentLabel: Record<string, string> = { friendly: "Vänlig", cautious: "Försiktig", shy: "Blyg", reactive: "Reaktiv", neutral: "Neutral", unknown: "Okänd" };

type Conn = { id?: string; from_user: string; to_user: string; message?: string };

type ListingItem = ReturnType<typeof findListings>[number];
type DogRecord = {
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
};

function getFirstDog(listing: ListingItem): DogRecord | undefined {
  const firstNeed = listing.needs[0];
  if (firstNeed) {
    const dog = listing.dogs.find((d) => d.id === firstNeed.dog);
    return dog as DogRecord | undefined;
  }
  return listing.dogs[0] as DogRecord | undefined;
}

function isPassOnly(listing: ListingItem): boolean {
  return listing.dogs.length === 0 && listing.needs.length === 0 && listing.capacities.length > 0;
}

function canPassStr(s: string | string[] | undefined): string {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  const hasSmall = arr.includes("small");
  const hasMedium = arr.includes("medium");
  const hasLarge = arr.includes("large");
  if (arr.includes("any") || (hasSmall && hasMedium && hasLarge)) return "alla storlekar";
  if (hasSmall && !hasMedium && !hasLarge) return "små hundar";
  if (hasSmall && hasMedium && !hasLarge) return "upp till mellanstora hundar";
  if (hasSmall && hasMedium && hasLarge) return "upp till stora hundar";
  if (hasMedium && !hasSmall && !hasLarge) return "bara mellanstora hundar";
  if (hasMedium && hasLarge && !hasSmall) return "upp till stora hundar";
  if (hasLarge && !hasSmall && !hasMedium) return "bara stora hundar";
  return arr.map((x) => sizeLabel[x] ?? x).join(", ");
}

function MatchCard(props: {
  listing: ListingItem;
  baseUrl: string;
  getConnections: () => Conn[];
  dateStr: (n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
  onOpenDetail: (userId: string) => void;
}) {
  const { listing, baseUrl, getConnections, dateStr, sizesStr, onOpenDetail } = props;
  const conns = () => getConnections();
  const me = () => pb.authStore.model?.id;
  const mutual = () => {
    const m = me();
    if (!m) return false;
    const c = conns();
    return c.some((x) => x.from_user === m && x.to_user === listing.user.id) && c.some((x) => x.from_user === listing.user.id && x.to_user === m);
  };
  const requestedMe = () => {
    const m = me();
    if (!m) return false;
    return conns().some((x) => x.from_user === listing.user.id && x.to_user === m);
  };
  const requestedOutgoing = () => {
    const m = me();
    if (!m) return false;
    return conns().some((x) => x.from_user === m && x.to_user === listing.user.id);
  };
  const firstDog = () => getFirstDog(listing);
  const passOnly = () => isPassOnly(listing);
  const firstNeed = () => listing.needs[0];
  const firstCapacity = () => listing.capacities[0];
  const needDatesStr = () => firstNeed() ? dateStr(firstNeed()!) : null;
  const capacityDatesStr = () => firstCapacity() ? dateStr(firstCapacity()!) : null;
  const canPass = () =>
    firstCapacity() ? canPassStr(firstCapacity()!.dog_sizes) : null;

  const locationStr = () => {
    const loc = listing.user.neighborhood || listing.user.city || listing.user.area;
    const dist = "distanceKm" in listing && typeof listing.distanceKm === "number" ? `~${Math.round(listing.distanceKm)} km` : null;
    if (loc && dist) return `${loc} · ${dist}`;
    if (loc) return loc;
    if (dist) return dist;
    return null;
  };

  const extraNeedsHint = () => listing.needs.length > 1 ? `+${listing.needs.length - 1}` : null;
  const extraCapacitiesHint = () => listing.capacities.length > 1 ? `+${listing.capacities.length - 1}` : null;

  return (
    <div
      class="card match-card match-card-compact"
      data-listing-id={listing.user.id}
      onClick={() => onOpenDetail(listing.user.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpenDetail(listing.user.id)}
    >
      {mutual() && <span class="match-card-badge">matchad</span>}
      {!mutual() && requestedMe() && <span class="match-card-badge match-card-badge-request">Vill ha kontakt</span>}
      {!mutual() && requestedOutgoing() && <span class="match-card-badge match-card-badge-outgoing">Intresse skickat</span>}
      <div class="match-card-body">
        <div class="match-card-info">
          <div class="match-card-header">
            <Avatar
              name={listing.user.name}
              city={listing.user.city}
              neighborhood={listing.user.neighborhood}
              area={listing.user.area}
              id={listing.user.id}
              avatar={listing.user.avatar}
              baseUrl={baseUrl}
              class="match-card-avatar"
            />
            <span class="match-card-username">{listing.user.name || "Okänd"}</span>
          </div>
          <div class="match-card-info-text">
            <div class="match-card-need-section">
              <Show
                when={!passOnly()}
                fallback={<p class="match-card-main">Vill endast passa</p>}
              >
                <p class="match-card-main">
                  Behöver passning av <span class="match-card-dog-name">{firstDog()?.name ?? "hund"}</span>
                  {extraNeedsHint() && <span class="match-card-hint"> {extraNeedsHint()}</span>}
                </p>
              </Show>
              {!passOnly() && needDatesStr() && (
                <div class="match-card-row">
                  <span class="match-card-pill">Behöver</span>
                  <span class="match-card-value">{needDatesStr()}</span>
                </div>
              )}
            </div>
            {(canPass() || (passOnly() && capacityDatesStr())) && (
              <div class="match-card-capacity-section">
                {(passOnly() || canPass()) && capacityDatesStr() && (
                  <div class="match-card-row">
                    <span class="match-card-pill">Tillgänglig</span>
                    <span class="match-card-value">{capacityDatesStr()}</span>
                  </div>
                )}
                {canPass() && (
                  <div class="match-card-row">
                    <span class="match-card-pill">Storlekar</span>
                    <span class="match-card-value">{canPass()}</span>
                    {extraCapacitiesHint() && <span class="match-card-hint">{extraCapacitiesHint()}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
          {locationStr() && (
            <div class="match-card-footer">
              <span class="match-card-pill">Plats</span>
              <span class="match-card-value">{locationStr()}</span>
            </div>
          )}
        </div>
        <div class="match-card-image">
        <Show
          when={!passOnly()}
          fallback={
            <div class="match-card-pass-only">
              <span class="match-card-pass-only-icon" aria-hidden="true">🐾</span>
              <span>Vill endast passa</span>
            </div>
          }
        >
          <Show
            when={firstDog()}
            fallback={
              <Avatar
                name={listing.user.name}
                city={listing.user.city}
                neighborhood={listing.user.neighborhood}
                area={listing.user.area}
                id={listing.user.id}
                avatar={listing.user.avatar}
                baseUrl={baseUrl}
                class="match-card-img"
              />
            }
          >
            {(dog) => (
              <DogImage
                dog={dog()}
                baseUrl={baseUrl}
                class="match-card-img"
              />
            )}
          </Show>
        </Show>
        </div>
      </div>
    </div>
  );
}

function MatchDetailModal(props: {
  listing: ListingItem;
  baseUrl: string;
  getConnections: () => Conn[];
  myNeeds?: { start_date?: string; end_date?: string; flexible_dates?: boolean }[];
  myCapacities?: { start_date?: string; end_date?: string; flexible_dates?: boolean }[];
  refreshing: () => boolean;
  onInterestedClick: (userId: string, userName?: string) => void;
  onRespondClick?: (conn: Conn, fromUserName?: string) => void;
  onWithdraw?: (userId: string) => void;
  onUnmatch?: (userId: string) => void;
  onClose: () => void;
  dateStr: (n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
}) {
  const { listing, baseUrl, getConnections, myNeeds = [], myCapacities = [], refreshing, onInterestedClick, onRespondClick, onWithdraw, onUnmatch, onClose, dateStr, sizesStr } = props;
  const conns = () => getConnections();
  const connFromThem = () => conns().find((c) => c.from_user === listing.user.id && c.to_user === pb.authStore.model?.id);
  const mutual = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    const c = conns();
    return c.some((x) => x.from_user === me && x.to_user === listing.user.id) && c.some((x) => x.from_user === listing.user.id && x.to_user === me);
  };
  const requested = () => {
    const me = pb.authStore.model?.id;
    if (!me) return false;
    return conns().some((x) => x.from_user === me && x.to_user === listing.user.id);
  };

  const compatibilityCallout = () => {
    let msg: string | null = null;
    for (const theirNeed of listing.needs) {
      const n = theirNeed as { start_date?: string; end_date?: string };
      for (const myCap of myCapacities) {
        if (datesOverlap(n.start_date, n.end_date, myCap.start_date, myCap.end_date)) {
          msg = `Dina datum överlappar med ${listing.user.name || "deras"} behov (${dateStr(theirNeed)}).`;
          break;
        }
      }
      if (msg) break;
    }
    if (!msg) {
      for (const theirCap of listing.capacities) {
        const c = theirCap as { start_date?: string; end_date?: string };
        for (const myNeed of myNeeds) {
          if (datesOverlap(c.start_date, c.end_date, myNeed.start_date, myNeed.end_date)) {
            msg = `Deras tillgänglighet överlappar med dina behov (${dateStr(theirCap)}).`;
            break;
          }
        }
        if (msg) break;
      }
    }
    return msg;
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="detail-modal-title" onClick={handleBackdropClick}>
      <div class="modal modal-detail" onClick={(e) => e.stopPropagation()}>
        <div class="modal-detail-header">
          <button type="button" class="match-detail-close" onClick={onClose} aria-label="Stäng">×</button>
        </div>
        <section class="modal-detail-scroll">
        {connFromThem() && (
          <div class="modal-detail-connection-banner">
            <strong>{listing.user.name || "De"} vill ha kontakt med dig</strong>
            {connFromThem()!.message && (
              <p class="modal-detail-connection-message">"{connFromThem()!.message}"</p>
            )}
          </div>
        )}

        {compatibilityCallout() && (
          <div class="modal-detail-compatibility">
            <span class="modal-detail-compatibility-icon" aria-hidden="true">✓</span>
            {compatibilityCallout()}
          </div>
        )}

        <div class="modal-detail-user-card">
          <Avatar
            name={listing.user.name}
            city={listing.user.city}
            neighborhood={listing.user.neighborhood}
            area={listing.user.area}
            id={listing.user.id}
            avatar={listing.user.avatar}
            baseUrl={baseUrl}
            class="modal-detail-avatar"
          />
          <div class="modal-detail-user-info">
            <h2 id="detail-modal-title" class="modal-detail-user-name">{listing.user.name || "Okänd"}</h2>
            {listing.dogs.length === 0 && listing.needs.length === 0 && listing.capacities.length > 0 && (
              <p class="modal-detail-user-line" style="color: var(--color-paw); font-weight: 600;">
                Vill bara passa hundar – har inte egen hund
              </p>
            )}
            {listing.user.area && <p class="modal-detail-user-line">{listing.user.area}</p>}
            {"distanceKm" in listing && typeof listing.distanceKm === "number" && (
              <p class="modal-detail-user-line">~{Math.round(listing.distanceKm)} km bort</p>
            )}
            {listing.user.bio && (
              <div class="modal-detail-bio">
                <strong class="modal-detail-bio-label">Om {listing.user.name || "dem"}</strong>
                <p class="modal-detail-bio-text">{listing.user.bio}</p>
              </div>
            )}
            {listing.user.breeds_owned_before && (
              <p class="modal-detail-user-line"><strong>Erfarenhet:</strong> {listing.user.breeds_owned_before}</p>
            )}
            {mutual() && listing.user.phone && (
              <p class="modal-detail-user-line"><strong>Telefon:</strong> <a href={`tel:${listing.user.phone}`}>{listing.user.phone}</a></p>
            )}
            {mutual() && listing.user.address_private && (
              <p class="modal-detail-user-line"><strong>Adress:</strong> {listing.user.address_private}</p>
            )}
          </div>
        </div>

        {listing.needs.length > 0 && (
          <div class="modal-detail-section">
            <strong>Behöver hundpassning</strong>
            <div class="modal-detail-cards">
              <For each={listing.needs}>
                {(n) => {
                  const dog = listing.dogs.find((d) => d.id === n.dog) as DogRecord | undefined;
                  const d = dog ?? {};
                  const needWithNotes = n as { notes?: string };
                  return (
                    <div class="need-card">
                      <div class="need-card-image">
                        <DogImage dog={d} baseUrl={baseUrl} class="dog-card-img" />
                      </div>
                      <div class="need-card-content">
                        <strong class="need-card-title">{d.name ?? "Hund"}</strong>
                        <div class="need-card-columns">
                          <div class="need-card-col">
                            {d.size && <p class="need-card-line"><span class="need-card-label">Storlek:</span> {sizeLabel[d.size] ?? d.size}</p>}
                            {d.breed && <p class="need-card-line"><span class="need-card-label">Ras:</span> {d.breed}</p>}
                            {d.gender && <p class="need-card-line"><span class="need-card-label">Kön:</span> {genderLabel[d.gender] ?? d.gender}</p>}
                            {d.age != null && <p class="need-card-line"><span class="need-card-label">Ålder:</span> {d.age} år</p>}
                          </div>
                          <div class="need-card-col">
                            {(d.temperament_new_people || d.temperament_new_dogs_female || d.temperament_new_dogs_male) && (
                              <p class="need-card-line">
                                <span class="need-card-label">Temperament:</span><br />
                                Nya människor: {temperamentLabel[d.temperament_new_people ?? ""] || d.temperament_new_people || "—"} · Nya hundar (Hona): {temperamentLabel[d.temperament_new_dogs_female ?? ""] || d.temperament_new_dogs_female || "—"} · Nya hundar (Hane): {temperamentLabel[d.temperament_new_dogs_male ?? ""] || d.temperament_new_dogs_male || "—"}
                              </p>
                            )}
                          </div>
                        </div>
                        {d.notes && <p class="need-card-notes"><span class="need-card-label">Anteckningar:</span> {d.notes}</p>}
                        {needWithNotes.notes && <p class="need-card-notes"><span class="need-card-label">Behov:</span> {needWithNotes.notes}</p>}
                        <div class="need-card-footer"><span class="need-card-label">Datum:</span> {dateStr(n)}</div>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        )}

        {listing.capacities.length > 0 && (
          <div class="modal-detail-section">
            <strong>Kan passa hundar</strong>
            <div class="modal-detail-cards">
              <For each={listing.capacities}>
                {(c) => {
                  const capWithNotes = c as { notes?: string };
                  return (
                    <div class="capacity-card">
                      <div class="capacity-card-content">
                        <div class="capacity-card-row">
                          <span class="need-card-label">Datum:</span> {dateStr(c)}
                        </div>
                        <div class="capacity-card-row">
                          <span class="need-card-label">Storlekar:</span> {sizesStr(c.dog_sizes)}
                        </div>
                        <div class="capacity-card-row">
                          <span class="need-card-label">Kön:</span> {genderLabel[c.dog_genders ?? "any"] ?? c.dog_genders}
                        </div>
                        <div class="capacity-card-row">
                          <span class="need-card-label">Max antal hundar:</span> {c.max_dogs}
                        </div>
                        {capWithNotes.notes && (
                          <p class="need-card-notes"><span class="need-card-label">Anteckningar:</span> {capWithNotes.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        )}
        </section>
        <div class="modal-detail-footer">
          <Show when={!mutual()}>
            {requested() ? (
              <>
                <span class="btn btn-secondary" style="cursor: default;">Intresse skickat</span>
                <button type="button" class="btn btn-secondary" disabled={refreshing()} onClick={() => onWithdraw?.(listing.user.id)}>Ångra</button>
              </>
            ) : connFromThem() && onRespondClick ? (
              <button type="button" class="btn" disabled={refreshing()} onClick={() => onRespondClick(connFromThem()!, listing.user.name)}>Svara</button>
            ) : (
              <button type="button" class="btn" disabled={refreshing()} onClick={() => onInterestedClick(listing.user.id, listing.user.name)}>Jag är intresserad</button>
            )}
          </Show>
          <Show when={mutual() && onUnmatch}>
            <button type="button" class="btn btn-secondary" disabled={refreshing()} onClick={() => onUnmatch?.(listing.user.id)}>Avmatcha</button>
          </Show>
        </div>
      </div>
    </div>
  );
}

function MatchCards(props: {
  listings: ReturnType<typeof findListings>;
  baseUrl: string;
  getConnections: () => Conn[];
  dateStr: (n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
  onOpenDetail: (userId: string) => void;
}) {
  return (
    <div class="match-cards-list">
      <For each={props.listings}>
        {(listing) => (
          <MatchCard
            listing={listing}
            baseUrl={props.baseUrl}
            getConnections={props.getConnections}
            dateStr={props.dateStr}
            sizesStr={props.sizesStr}
            onOpenDetail={props.onOpenDetail}
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
  const [detailModalListingId, setDetailModalListingId] = createSignal<string | undefined>();
  const [mobileViewMode, setMobileViewMode] = createSignal<"list" | "map">("list");
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
          message: (c as { message?: string }).message,
        }));
        const myNeeds = (needsArr as { user: string; start_date?: string; end_date?: string; flexible_dates?: boolean }[]).filter((n) => n.user === userId);
        const myCapacities = (capacitiesArr as { user: string; start_date?: string; end_date?: string; flexible_dates?: boolean }[]).filter((c) => c.user === userId);
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
        if (!prev) {
          return prev;
        }
        const next = { ...prev, connections: [...prev.connections, created] };
        return next;
      });
      showToast("Intresse skickat");
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

  const [interestModalTarget, setInterestModalTarget] = createSignal<{ userId: string; userName?: string } | undefined>();
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
    await handleInterested(target.userId, interestModalMessage().trim() || undefined);
    closeInterestModal();
  }

  const [respondModalTarget, setRespondModalTarget] = createSignal<{ requestId: string; fromUserId: string; fromUserName?: string } | undefined>();
  const [respondModalMessage, setRespondModalMessage] = createSignal("");

  function openRespondModal(conn: Conn, fromUserName?: string) {
    if (!conn.id) return;
    setRespondModalTarget({ requestId: conn.id, fromUserId: conn.from_user, fromUserName });
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
        return { ...prev, connections: prev.connections.filter((c: { id?: string }) => c.id !== target.requestId) };
      });
      closeRespondModal();
    } catch (e) {
      console.error("[matches] handleRejectRequest error", e);
      refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpenDetail(userId: string) {
    setSelectedUserId(userId);
    setDetailModalListingId(userId);
  }

  function handleCloseDetail() {
    setDetailModalListingId(undefined);
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
    setDetailModalListingId(userId);
    const idx = data()?.listings.findIndex((l) => l.user.id === userId);
    if (idx !== undefined && idx >= 0 && listContainerRef && mobileViewMode() === "list") {
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
    const detailId = detailModalListingId();
    const filtered = filteredListings();
    if (selected && !filtered.some((l) => l.user.id === selected)) {
      setSelectedUserId(undefined);
      if (detailId === selected) setDetailModalListingId(undefined);
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
          <div
            class="matches-split"
            classList={{
              "matches-split-list-only": mobileViewMode() === "list",
              "matches-split-map-only": mobileViewMode() === "map",
            }}
          >
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
                getConnections={() => (data()?.connections ?? []) as Conn[]}
                dateStr={dateStr}
                sizesStr={sizesStr}
                onOpenDetail={handleOpenDetail}
              />
              </Show>
            </div>
          </div>
          <div class="container">
            <p style="font-size: 0.875rem; color: var(--color-text-muted); margin-top: 0.5rem;">
              Zooma in för att filtrera. Klicka på ett kort eller en markör för att se detaljer.
            </p>
          </div>
        </Show>
      <Show when={detailModalListingId()}>
        {(userId) => {
          const listing = () => filteredListings().find((l) => l.user.id === userId());
          return (
            <Show when={listing()}>
              {(l) => (
                <MatchDetailModal
                  listing={l()!}
                  baseUrl={baseUrl}
                  getConnections={() => (data()?.connections ?? []) as Conn[]}
                  myNeeds={data()?.myNeeds}
                  myCapacities={data()?.myCapacities}
                  refreshing={refreshing}
                  onInterestedClick={openInterestModal}
                  onRespondClick={openRespondModal}
                  onWithdraw={handleWithdraw}
                  onUnmatch={handleUnmatch}
                  onClose={handleCloseDetail}
                  dateStr={dateStr}
                  sizesStr={sizesStr}
                />
              )}
            </Show>
          );
        }}
      </Show>
      </div>
      <Show when={interestModalTarget()}>
        {(target) => (
          <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="interest-modal-title" onClick={closeInterestModal}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h2 id="interest-modal-title" style="margin: 0;">Skicka intresseförfrågan</h2>
                <button type="button" class="match-detail-close" onClick={closeInterestModal} aria-label="Stäng">×</button>
              </div>
              <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
                {target().userName ? `Skriv ett meddelande till ${target().userName} (valfritt):` : "Skriv ett meddelande (valfritt):"}
              </p>
              <div class="form-group">
                <label for="interest-message">Meddelande</label>
                <textarea
                  id="interest-message"
                  placeholder="T.ex. Hej! Jag är intresserad av att byta hundpassning..."
                  value={interestModalMessage()}
                  onInput={(e) => setInterestModalMessage(e.currentTarget.value)}
                  rows={4}
                  maxLength={500}
                  style="resize: vertical;"
                />
              </div>
              <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
                <button type="button" class="btn btn-secondary" onClick={closeInterestModal}>
                  Avbryt
                </button>
                <button
                  type="button"
                  class="btn"
                  disabled={refreshing()}
                  onClick={() => submitInterestModal()}
                >
                  Skicka
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={respondModalTarget()}>
        {(target) => (
          <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="respond-modal-title" onClick={closeRespondModal}>
            <div class="modal" onClick={(e) => e.stopPropagation()}>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h2 id="respond-modal-title" style="margin: 0;">Svara på förfrågan</h2>
                <button type="button" class="match-detail-close" onClick={closeRespondModal} aria-label="Stäng">×</button>
              </div>
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
                <button type="button" class="btn btn-secondary" disabled={refreshing()} onClick={handleRejectRequest}>
                  Avvisa
                </button>
                <button
                  type="button"
                  class="btn"
                  disabled={refreshing()}
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
