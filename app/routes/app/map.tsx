import { A } from "@solidjs/router";
import { createEffect, createResource, createSignal, onCleanup, Show } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pb } from "~/lib/pocketbase";
import { findListings } from "~/lib/matching";
import { AppShell } from "~/components/AppShell";

const DISTANCE_OPTIONS = [5, 10, 25, 50, 100] as const;

function getStoredMaxDistance(): number {
  if (typeof localStorage === "undefined") return 50;
  const v = localStorage.getItem("matches_max_distance_km");
  const n = v ? parseInt(v, 10) : NaN;
  return DISTANCE_OPTIONS.includes(n as (typeof DISTANCE_OPTIONS)[number]) ? n : 50;
}

export default function MatchesMap() {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  let map: L.Map | null = null;

  const [data] = createResource(
    () => [pb.authStore.model?.id, getStoredMaxDistance()] as const,
    async ([userId, maxDist]) => {
      if (!userId) return null;
      const [needs, capacities, users, dogs] = await Promise.all([
        pb.collection("watch_needs").getFullList(),
        pb.collection("watch_capacity").getFullList(),
        pb.collection("users").getFullList(),
        pb.collection("dogs").getFullList(),
      ]);
      const listings = findListings(
        needs as Parameters<typeof findListings>[0],
        capacities as Parameters<typeof findListings>[1],
        userId,
        users as Parameters<typeof findListings>[4],
        dogs as Parameters<typeof findListings>[5],
        maxDist
      );
      return { listings, me: users.find((u: { id: string }) => u.id === userId) };
    }
  );

  createEffect(() => {
    const el = mapRef();
    const d = data();
    if (!el || !d) return;

    if (map) {
      map.remove();
      map = null;
    }

    const me = d.me as { latitude?: number; longitude?: number } | undefined;
    const listings = d.listings;
    const hasCoords = typeof me?.latitude === "number" && typeof me?.longitude === "number";

    const defaultCenter: [number, number] = hasCoords
      ? [me!.latitude!, me!.longitude!]
      : [55.6, 13.0]; // Malmö fallback

    map = L.map(el).setView(defaultCenter, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markers: L.Marker[] = [];

    if (hasCoords) {
      const meIcon = L.divIcon({
        className: "marker-me",
        html: '<div style="width:24px;height:24px;background:#7cb342;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker([me!.latitude!, me!.longitude!], { icon: meIcon })
        .addTo(map!)
        .bindPopup("<strong>You</strong>");
      markers.push(marker);
    }

    const providerIcon = L.divIcon({
      className: "marker-provider",
      html: '<div style="width:20px;height:20px;background:#8b5a2b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    for (const listing of listings) {
      const u = listing.user as { latitude?: number; longitude?: number; name?: string; area?: string };
      if (typeof u.latitude !== "number" || typeof u.longitude !== "number") continue;
      const m = L.marker([u.latitude, u.longitude], { icon: providerIcon })
        .addTo(map!)
        .bindPopup(`<strong>${u.name || "Unknown"}</strong><br>${u.area || ""}`);
      markers.push(m);
    }

    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));
      map!.fitBounds(bounds.pad(0.1));
    }
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  return (
    <AppShell>
      <div class="container">
        <div class="page-hero">
          <span class="paw-emoji">🗺️</span>
          <h1>Map</h1>
          <p style="color: var(--color-text-muted);">
            Providers in your area. <A href="/app/matches">Back to list</A>
          </p>
        </div>
        <Show when={!pb.authStore.model?.area && !pb.authStore.model?.city}>
          <p style="color: #dc2626;">
            <A href="/app/profile">Set your address</A> in your profile to see the map.
          </p>
        </Show>
        <Show when={data.loading}>
          <p>Loading...</p>
        </Show>
        <Show when={data.error}>
          <p style="color: #dc2626;">{data.error?.message}</p>
        </Show>
        <Show when={data()?.listings.length === 0 && !data.loading && pb.authStore.model?.area}>
          <p>No providers in your area yet.</p>
        </Show>
        <Show when={data() && pb.authStore.model?.area}>
          <div
            ref={setMapRef}
            style={{
              height: "400px",
              width: "100%",
              "border-radius": "var(--radius)",
              "margin-top": "1rem",
            }}
          />
        </Show>
      </div>
    </AppShell>
  );
}
