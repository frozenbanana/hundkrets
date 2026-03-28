import { createEffect, createSignal, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ListingWithDistance } from "~/lib/matching";
import { approximateCoords } from "~/lib/geocode";
import type { MapBounds } from "~/lib/geocode";

function extractBounds(b: L.LatLngBounds): MapBounds {
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}

interface Props {
  listings: ListingWithDistance[];
  /** Returns true if user is mutually matched (both expressed interest) */
  mutualUserIds?: (userId: string) => boolean;
  /** Set of user IDs who have sent a connection request to me */
  requestedMeUserIds?: Set<string>;
  myLat?: number;
  myLon?: number;
  /** When true, filter markers to visible map bounds (zoom to narrow) */
  filterByBounds?: boolean;
  /** Called when map bounds change (move/zoom). Use to filter search results. */
  onBoundsChange?: (bounds: MapBounds | null) => void;
  /** Highlight and zoom to this user's listing */
  selectedUserId?: string;
  /** User ID of card being hovered (desktop) – marker grows slightly */
  hoveredUserId?: string;
  /** Base URL for avatar images */
  baseUrl: string;
  style?: Record<string, string>;
}

export function MatchesMap(props: Props) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  let map: L.Map | null = null;
  let markerLayer: L.LayerGroup | null = null;
  let prevEl: HTMLDivElement | null = null;
  let prevListings: typeof props.listings | null = null;

  createEffect(() => {
    const el = mapRef();
    const listings = props.listings;
    const selectedId = props.selectedUserId;
    const hoveredId = props.hoveredUserId;
    if (!el) return;

    const elChanged = prevEl !== el;
    const listChanged = prevListings !== listings;
    if (map && (elChanged || listChanged)) {
      map.remove();
      map = null;
      markerLayer = null;
    }
    prevEl = el;
    prevListings = listings;

    const hasCoords =
      typeof props.myLat === "number" && typeof props.myLon === "number";

    if (!map) {
      const defaultCenter: [number, number] = hasCoords
        ? [props.myLat!, props.myLon!]
        : [59.33, 18.07]; // Stockholm fallback

      map = L.map(el).setView(defaultCenter, 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      markerLayer = L.layerGroup().addTo(map);
    }

    const updateMarkers = (currentBounds: L.LatLngBounds | null, skipSetView = false) => {
      if (!markerLayer || !map) return;
      markerLayer.clearLayers();

      if (hasCoords) {
        const meIcon = L.divIcon({
          className: "marker-me",
          html: '<div style="width:24px;height:24px;background:#7cb342;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([props.myLat!, props.myLon!], { icon: meIcon })
          .addTo(markerLayer!)
          .bindPopup("<strong>Du</strong>");
      }

      let selectedLatLng: [number, number] | null = null;

      for (const listing of listings) {
        const u = listing.user as {
          id?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
          area?: string;
          avatar?: string;
          bio?: string;
        };
        if (typeof u.latitude !== "number" || typeof u.longitude !== "number") continue;
        const [lat, lon] = approximateCoords(u.latitude, u.longitude, u.id ?? "");
        if (props.filterByBounds && currentBounds && !currentBounds.contains([lat, lon])) continue;

        const isSelected = selectedId === u.id;
        if (isSelected) selectedLatLng = [lat, lon];

        const isMatched = props.mutualUserIds?.(u.id ?? "") ?? false;
        const requestedMe = props.requestedMeUserIds?.has(u.id ?? "") ?? false;
        const markerColor = isMatched ? "#e65100" : requestedMe ? "#16a34a" : "#2563eb";
        const isHovered = hoveredId === u.id;
        const size = isSelected ? 28 : isHovered ? 24 : 20;

        const providerIcon = L.divIcon({
          className: "marker-provider",
          html: `<div style="width:${size}px;height:${size}px;background:${markerColor};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);transition:width 0.15s,height 0.15s;"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const avatarUrl =
          u.avatar && u.id
            ? `${props.baseUrl}/api/files/users/${u.id}/${u.avatar}`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "User")}&size=48&background=d4a574&color=ffffff`;
        const bio = (u.bio || "").trim();
        const bioTruncated = bio.length > 100 ? bio.slice(0, 97) + "..." : bio;
        const profileUrl = `/users/${u.id}?from=explore`;
        const esc = (s: string) => s.replace(/</g, "&lt;").replace(/"/g, "&quot;");
        const dogs = (listing.dogs ?? []) as { id?: string; image?: string; name?: string; breed?: string; age?: number }[];
        const dogsHtml =
          dogs.length > 0
            ? dogs
                .map((d) => {
                  const imgUrl =
                    d.image && d.id
                      ? `${props.baseUrl}/api/files/dogs/${d.id}/${d.image}`
                      : "";
                  const ageStr = typeof d.age === "number" ? `${d.age} år` : "";
                  const parts = [d.name || "Hund", ageStr, d.breed || ""].filter(Boolean);
                  const infoStr = parts.join(" · ");
                  return `
                    <div class="map-popup-dog-row">
                      ${imgUrl ? `<img src="${imgUrl}" alt="" class="map-popup-dog-img" />` : '<div class="map-popup-dog-placeholder">🐕</div>'}
                      <span class="map-popup-dog-info">${esc(infoStr)}</span>
                    </div>
                  `;
                })
                .join("")
            : "";
        const popupHtml = `
          <div class="map-popup-mini-card">
            <img src="${avatarUrl}" alt="" class="map-popup-avatar" />
            <div class="map-popup-main">
              <div class="map-popup-header">
                <strong class="map-popup-name">${esc(u.name || "Okänd")}</strong>
                <a href="${profileUrl}" class="map-popup-link" aria-label="Besök profil" title="Besök profil">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
              </div>
              ${bioTruncated ? `<p class="map-popup-bio">${esc(bioTruncated)}</p>` : ""}
              ${dogs.length > 0
                ? `<div class="map-popup-dogs-section">
                <span class="map-popup-dogs-label">Hund(ar)</span>
                <div class="map-popup-dogs-list">${dogsHtml}</div>
              </div>`
                : '<p class="map-popup-no-dogs">Inga hundar registrerade</p>'}
            </div>
          </div>
        `;

        L.marker([lat, lon], { icon: providerIcon })
          .addTo(markerLayer!)
          .bindPopup(popupHtml, { className: "map-popup-mini", closeButton: false });
      }

      const layerCount = markerLayer.getLayers().length;
      if (!skipSetView) {
        if (selectedLatLng && map) {
          map.setView(selectedLatLng, Math.max(map.getZoom(), 12));
        } else if (layerCount > 1 && !currentBounds && map) {
          const allLayers = markerLayer.getLayers() as L.Marker[];
          const b = L.latLngBounds(allLayers.map((marker) => marker.getLatLng()));
          map.fitBounds(b.pad(0.1));
        }
      }
    };

    let onMove: (() => void) | null = null;
    if (map && props.filterByBounds) {
      onMove = () => {
        const b = map!.getBounds();
        updateMarkers(b, true);
        props.onBoundsChange?.(extractBounds(b));
      };
      map.on("moveend", onMove);
      map.on("zoomend", onMove);
    }

    if (elChanged && props.filterByBounds && map && hasCoords) {
      // First render: place all markers (no bounds filter) then fit to nearest
      updateMarkers(null, true);

      const allLayers = markerLayer!.getLayers() as L.Marker[];
      const myPos = L.latLng(props.myLat!, props.myLon!);
      const otherPoints = allLayers
        .map((m) => m.getLatLng())
        .filter((ll) => ll.distanceTo(myPos) > 50)
        .sort((a, b) => a.distanceTo(myPos) - b.distanceTo(myPos));

      if (otherPoints.length > 0) {
        const nearest = otherPoints.slice(0, 5);
        nearest.push(myPos);
        map.fitBounds(L.latLngBounds(nearest).pad(0.15), { maxZoom: 13, animate: false });
      }

      // Re-run with actual bounds so the list syncs
      const b = map.getBounds();
      updateMarkers(b, true);
      props.onBoundsChange?.(extractBounds(b));
    } else {
      const initialBounds = props.filterByBounds && map ? map.getBounds() : null;
      const skipViewUpdate = !elChanged && !listChanged;
      updateMarkers(initialBounds, skipViewUpdate);
      if (props.filterByBounds && map && props.onBoundsChange) {
        props.onBoundsChange(initialBounds ? extractBounds(initialBounds) : null);
      } else if (!props.filterByBounds && props.onBoundsChange) {
        props.onBoundsChange(null);
      }
    }

    return () => {
      if (onMove && map) {
        map.off("moveend", onMove);
        map.off("zoomend", onMove);
      }
    };
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
      markerLayer = null;
    }
  });

  return (
    <div
      ref={setMapRef}
      style={{
        height: props.style?.height ?? "350px",
        minHeight: props.style?.["min-height"],
        width: "100%",
        borderRadius: props.style?.["border-radius"] ?? "var(--radius)",
        marginTop: props.style?.["margin-top"] ?? "1rem",
      }}
    />
  );
}
