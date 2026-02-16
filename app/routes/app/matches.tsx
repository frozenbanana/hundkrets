import { A } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { findListings } from "~/lib/matching";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import { MatchesMap } from "~/components/MatchesMap";

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100] as const;

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

function dogSummary(d: { name?: string; breed?: string; size?: string; gender?: string; age?: number }) {
  const parts = [d.name ?? "Hund"];
  if (d.breed) parts.push(d.breed);
  const sizeStr = d.size ? d.size.charAt(0).toUpperCase() + d.size.slice(1) : "";
  const genderStr = d.gender ? genderLabel[d.gender] ?? d.gender : "";
  const ageStr = d.age != null ? `${d.age} år` : "";
  const meta = [sizeStr, genderStr, ageStr].filter(Boolean).join(", ");
  if (meta) parts.push(meta);
  return parts.filter(Boolean).join(" • ");
}

function MatchCard(props: {
  listing: ReturnType<typeof findListings>[number];
  baseUrl: string;
  isMutual: (id: string) => boolean;
  iRequested: (id: string) => boolean;
  refreshing: () => boolean;
  onInterested: (id: string) => void;
  onSelect?: (userId: string) => void;
  isSelected?: boolean;
  dateStr: (n: { flexible_dates?: boolean; open_any_duration?: boolean; duration_specific?: string; start_date?: string; end_date?: string }) => string;
  sizesStr: (s: string | string[] | undefined) => string;
}) {
  const [expanded, setExpanded] = createSignal(false);
  const { listing, baseUrl, isMutual, iRequested, refreshing, onInterested, onSelect, isSelected, dateStr, sizesStr } = props;
  const mutual = isMutual(listing.user.id);
  const requested = iRequested(listing.user.id);

  return (
    <div
      class="card"
      classList={{ "match-card-selected": isSelected }}
      data-listing-id={listing.user.id}
      onClick={() => onSelect?.(listing.user.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.(listing.user.id)}
    >
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
          {listing.dogs.length > 0 && (
            <p style="font-size: 0.9rem; margin: 0.5rem 0 0; color: var(--color-text);">
              <strong>Hundar:</strong>{" "}
              {listing.dogs.map((d) => dogSummary(d as { name?: string; breed?: string; size?: string; gender?: string; age?: number })).join(" · ")}
            </p>
          )}
          {mutual && listing.user.phone && (
            <p style="margin-top: 0.5rem;">
              <strong>Telefon:</strong> <a href={`tel:${listing.user.phone}`}>{listing.user.phone}</a>
            </p>
          )}
          {mutual && listing.user.address_private && (
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
                      {(d.breed || d.size || d.gender || d.age != null) && (
                        <span style="color: var(--color-text-muted); font-size: 0.875rem;">
                          {" "}
                          — {[d.breed, d.size ? sizeLabel[d.size] ?? d.size : "", d.gender ? genderLabel[d.gender] : "", d.age != null ? `${d.age} år` : ""].filter(Boolean).join(" • ")}
                        </span>
                      )}
                      <p>{dateStr(n)}</p>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      )}
      {listing.capacities.length > 0 && (
        <div style="margin-bottom: 0.75rem;">
          <strong>Kan passa hundar:</strong>
          <ul style="margin: 0.25rem 0 0 1.25rem; padding: 0;">
            <For each={listing.capacities}>
              {(c) => (
                <li>
                  {dateStr(c)} • {sizesStr(c.dog_sizes)} • max {c.max_dogs}
                </li>
              )}
            </For>
          </ul>
        </div>
      )}

      <button
        type="button"
        class="btn btn-secondary"
        style="margin-bottom: 0.75rem; font-size: 0.875rem;"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded()); }}
      >
        {expanded() ? "Visa mindre" : "Se mer"}
      </button>

      <Show when={expanded()}>
        <div
          style="padding: 0.75rem; background: var(--color-fur-light, #f8f4ef); border-radius: var(--radius); margin-bottom: 1rem; font-size: 0.9rem;"
        >
          <h4 style="margin: 0 0 0.5rem; font-size: 0.95rem;">Hundar</h4>
          <For each={listing.dogs}>
            {(d) => {
                const dog = d as {
                  name?: string;
                  breed?: string;
                  size?: string;
                  gender?: string;
                  age?: number;
                  notes?: string;
                  temperament_new_people?: string;
                  temperament_new_dogs_female?: string;
                  temperament_new_dogs_male?: string;
                };
              return (
                <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--color-fur);">
                  <strong>{dog.name ?? "Hund"}</strong>
                  <span style="color: var(--color-text-muted);">
                    {" "}
                    {[dog.breed, dog.size ? sizeLabel[dog.size] : "", dog.gender ? genderLabel[dog.gender] : "", dog.age != null ? `${dog.age} år` : ""].filter(Boolean).join(" • ")}
                  </span>
                  <p style="margin: 0.25rem 0; color: var(--color-text-muted); font-size: 0.85rem;">
                    Temperament: Nya människor {temperamentLabel[dog.temperament_new_people ?? ""] || dog.temperament_new_people || "—"} • Nya hundar (Hona) {temperamentLabel[dog.temperament_new_dogs_female ?? ""] || dog.temperament_new_dogs_female || "—"} • Nya hundar (Hane) {temperamentLabel[dog.temperament_new_dogs_male ?? ""] || dog.temperament_new_dogs_male || "—"}
                  </p>
                  {dog.notes && <p style="margin: 0.25rem 0;">{dog.notes}</p>}
                </div>
              );
            }}
          </For>

          <h4 style="margin: 0.75rem 0 0.5rem; font-size: 0.95rem;">Behov (detaljer)</h4>
          <For each={listing.needs}>
            {(n) => {
              const need = n as { notes?: string; duration_specific?: string };
              const dog = listing.dogs.find((d) => d.id === n.dog);
              return (
                <div style="margin-bottom: 0.5rem;">
                  <strong>{dog?.name ?? "Hund"}:</strong> {dateStr(n)}
                  {need.duration_specific && <span style="color: var(--color-text-muted);"> — {need.duration_specific}</span>}
                  {need.notes && <p style="margin: 0.25rem 0;">{need.notes}</p>}
                </div>
              );
            }}
          </For>

          <h4 style="margin: 0.75rem 0 0.5rem; font-size: 0.95rem;">Kapacitet (detaljer)</h4>
          <For each={listing.capacities}>
            {(c) => {
              const cap = c as { notes?: string; duration_specific?: string; dog_sizes?: string | string[]; dog_genders?: string; max_dogs?: number };
              return (
                <div style="margin-bottom: 0.5rem;">
                  {dateStr(c)} • {sizesStr(c.dog_sizes)} • max {c.max_dogs}
                  {cap.duration_specific && <span style="color: var(--color-text-muted);"> — {cap.duration_specific}</span>}
                  {cap.notes && <p style="margin: 0.25rem 0;">{cap.notes}</p>}
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <div style="margin-top: 1rem;" onClick={(e) => e.stopPropagation()}>
        {mutual ? (
          <span class="btn" style="background: var(--color-grass); cursor: default;">
            ✓ Kopplad
          </span>
        ) : requested ? (
          <span class="btn btn-secondary" style="cursor: default;">
            Intresse skickat
          </span>
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
      </div>
    </div>
  );
}

function MatchCards(props: {
  listings: ReturnType<typeof findListings>;
  baseUrl: string;
  isMutual: (id: string) => boolean;
  iRequested: (id: string) => boolean;
  refreshing: () => boolean;
  onInterested: (id: string) => void;
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
            isMutual={props.isMutual}
            iRequested={props.iRequested}
            refreshing={props.refreshing}
            onInterested={props.onInterested}
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

function getStoredMaxDistance(): number {
  if (typeof localStorage === "undefined") return 50;
  const v = localStorage.getItem("matches_max_distance_km");
  const n = v ? parseInt(v, 10) : NaN;
  return DISTANCE_OPTIONS.includes(n as (typeof DISTANCE_OPTIONS)[number]) ? n : 50;
}

export default function Matches() {
  const [refreshing, setRefreshing] = createSignal(false);
  const [maxDistanceKm, setMaxDistanceKm] = createSignal(getStoredMaxDistance());
  const [selectedUserId, setSelectedUserId] = createSignal<string | undefined>(undefined);
  let listContainerRef: HTMLDivElement | undefined;

  const [data, { refetch }] = createResource(
    () => [pb.authStore.model?.id, maxDistanceKm()] as const,
    async ([userId, maxDist]) => {
      if (!userId) return null;
      try {
        const [needs, capacities, users, dogs, connectionsResult] = await Promise.all([
          pb.collection("watch_needs").getFullList(),
          pb.collection("watch_capacity").getFullList(),
          pb.collection("users").getFullList(),
          pb.collection("dogs").getFullList(),
          pb.collection("connection_requests").getFullList().catch(() => []),
        ]);
        const connections = connectionsResult;
        const listings = findListings(
          needs as Parameters<typeof findListings>[0],
          capacities as Parameters<typeof findListings>[1],
          userId,
          users as Parameters<typeof findListings>[3],
          dogs as Parameters<typeof findListings>[4],
          maxDist
        );
        return { listings, connections };
      } catch (err) {
        const e = err as { status?: number; message?: string; url?: string };
        console.error("Matches fetch failed:", e?.status, e?.message, e?.url);
        throw err;
      }
    }
  );

  function handleDistanceChange(e: Event) {
    const v = parseInt((e.currentTarget as HTMLSelectElement).value, 10);
    setMaxDistanceKm(v);
    localStorage.setItem("matches_max_distance_km", String(v));
  }

  async function handleInterested(toUserId: string) {
    const fromUserId = pb.authStore.model?.id;
    if (!fromUserId) return;
    setRefreshing(true);
    try {
      await pb.collection("connection_requests").create({
        from_user: fromUserId,
        to_user: toUserId,
      });
      refetch();
    } catch (e) {
      if ((e as { status?: number })?.status !== 400) console.error(e);
      refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function isMutual(listingUserId: string): boolean {
    const me = pb.authStore.model?.id;
    if (!me || !data()?.connections) return false;
    const conns = data()!.connections as { from_user: string; to_user: string }[];
    const iRequested = conns.some((c) => c.from_user === me && c.to_user === listingUserId);
    const theyRequested = conns.some((c) => c.from_user === listingUserId && c.to_user === me);
    return iRequested && theyRequested;
  }

  function iRequested(listingUserId: string): boolean {
    const me = pb.authStore.model?.id;
    if (!me || !data()?.connections) return false;
    return (data()!.connections as { from_user: string; to_user: string }[]).some(
      (c) => c.from_user === me && c.to_user === listingUserId
    );
  }

  function handleSelect(userId: string) {
    setSelectedUserId((prev) => (prev === userId ? undefined : userId));
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
          <p style="color: #dc2626;">
            <A href="/app/profile">Ange din adress</A> i profilen för att se matchningar.
          </p>
        </Show>
        <Show when={pb.authStore.model?.area && !pb.authStore.model?.latitude && !pb.authStore.model?.longitude}>
          <p style="color: var(--color-text-muted); margin-bottom: 0.5rem;">
            <A href="/app/profile">Uppdatera din profil med full adress</A> för att filtrera på avstånd och se kartan.
          </p>
        </Show>
        <Show when={data.loading}>
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
          <A href="/app/needs/new" class="btn">Lägg till behov</A>
          <A href="/app/capacity/new" class="btn btn-secondary" style="margin-left: 0.5rem;">Lägg till kapacitet</A>
        </Show>
        <Show when={data()?.listings && data()!.listings.length > 0}>
          <div class="matches-toolbar">
            <label for="distance-filter" style="display: flex; align-items: center; gap: 0.5rem;">
              <span>Inom</span>
              <select
                id="distance-filter"
                value={maxDistanceKm()}
                onInput={handleDistanceChange}
                style={{ padding: "0.25rem 0.5rem", "border-radius": "var(--radius)" }}
              >
                {DISTANCE_OPTIONS.map((km) => (
                  <option value={km}>{km} km</option>
                ))}
              </select>
            </label>
          </div>
        </Show>
        </div>
        <Show when={data()?.listings && data()!.listings.length > 0}>
          <div class="matches-split">
            <div class="matches-map-panel">
              <MatchesMap
                listings={data()!.listings}
                myLat={pb.authStore.model?.latitude}
                myLon={pb.authStore.model?.longitude}
                filterByBounds
                selectedUserId={selectedUserId()}
                onMarkerClick={handleMarkerClick}
                style={{ height: "100%", "min-height": "400px" }}
              />
            </div>
            <div
              class="matches-list-panel"
              ref={(el) => { listContainerRef = el; }}
            >
              <MatchCards
                listings={data()!.listings}
                baseUrl={baseUrl}
                isMutual={isMutual}
                iRequested={iRequested}
                refreshing={refreshing}
                onInterested={handleInterested}
                selectedUserId={selectedUserId()}
                onSelect={handleSelect}
                dateStr={dateStr}
                sizesStr={sizesStr}
              />
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
