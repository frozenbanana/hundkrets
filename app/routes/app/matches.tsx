import { A } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { findListings } from "~/lib/matching";
import { AppShell } from "~/components/AppShell";
import { MatchesMap } from "~/components/MatchesMap";

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100] as const;

function dateStr(n: {
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  start_date?: string;
  end_date?: string;
}) {
  if (!n.flexible_dates) return `${n.start_date ?? "—"} – ${n.end_date ?? "—"}`;
  if (n.open_any_duration !== false) return "Flexible, any duration";
  return n.duration_specific ? `Flexible: ${n.duration_specific}` : "Flexible";
}

function sizesStr(s: string | string[] | undefined) {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  if (arr.length >= 3) return "Any size";
  return arr.map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(", ");
}

function getStoredMaxDistance(): number {
  if (typeof localStorage === "undefined") return 50;
  const v = localStorage.getItem("matches_max_distance_km");
  const n = v ? parseInt(v, 10) : NaN;
  return DISTANCE_OPTIONS.includes(n as (typeof DISTANCE_OPTIONS)[number]) ? n : 50;
}

type ViewMode = "list" | "map";

export default function Matches() {
  const [refreshing, setRefreshing] = createSignal(false);
  const [maxDistanceKm, setMaxDistanceKm] = createSignal(getStoredMaxDistance());
  const [viewMode, setViewMode] = createSignal<ViewMode>("list");

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
        users as Parameters<typeof findListings>[4],
        dogs as Parameters<typeof findListings>[5],
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

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  return (
    <AppShell>
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
          <div style="margin-top: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
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
            <div style="display: flex; gap: 0.25rem;">
              <button
                type="button"
                class={viewMode() === "list" ? "btn" : "btn btn-secondary"}
                onClick={() => setViewMode("list")}
              >
                Lista
              </button>
              <button
                type="button"
                class={viewMode() === "map" ? "btn" : "btn btn-secondary"}
                onClick={() => setViewMode("map")}
              >
                Karta
              </button>
            </div>
          </div>
          <Show when={viewMode() === "map"}>
            <MatchesMap
              listings={data()!.listings}
              myLat={pb.authStore.model?.latitude}
              myLon={pb.authStore.model?.longitude}
            />
          </Show>
          <Show when={viewMode() === "list"}>
          <div style="margin-top: 1rem;">
            <For each={data()!.listings}>
              {(listing) => {
                const mutual = isMutual(listing.user.id);
                const requested = iRequested(listing.user.id);
                return (
                  <div class="card">
                    <div class="dog-card" style="margin-bottom: 1rem;">
                      {listing.dogs[0]?.image ? (
                        <img
                          src={`${baseUrl}/api/files/dogs/${listing.dogs[0].id}/${listing.dogs[0].image}`}
                          alt={listing.dogs[0].name}
                          class="dog-card-img"
                        />
                      ) : (
                        <div class="dog-card-img-placeholder">🐕</div>
                      )}
                      <div>
                        <h3 style="margin: 0;">{listing.user.name || "Unknown"}</h3>
                        {listing.user.area && (
                          <p style="color: var(--color-text-muted); margin: 0.25rem 0;">{listing.user.area}</p>
                        )}
                        {"distanceKm" in listing && typeof listing.distanceKm === "number" && (
                          <p style="color: var(--color-text-muted); margin: 0.25rem 0; font-size: 0.875rem;">
                            ~{Math.round(listing.distanceKm)} km bort
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
                        <ul style="margin: 0.25rem 0 0 1.25rem; padding: 0;">
                          <For each={listing.needs}>
                            {(n) => {
                              const dog = listing.dogs.find((d) => d.id === n.dog);
                              return (
                                <li>
                                  {dog?.name ?? "Dog"} • {dateStr(n)}
                                </li>
                              );
                            }}
                          </For>
                        </ul>
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

                    <div style="margin-top: 1rem;">
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
                          onClick={() => handleInterested(listing.user.id)}
                        >
                          Jag är intresserad
                        </button>
                      )}
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
          </Show>
        </Show>
      </div>
    </AppShell>
  );
}
