import { createEffect, createSignal, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ListingWithDistance } from "~/lib/matching";

/** ~500m jitter for privacy—approximate location only. Deterministic per userId. */
function approximateCoords(lat: number, lon: number, userId: string): [number, number] {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h << 5) - h + userId.charCodeAt(i);
  const seed = Math.abs(h % 1000) / 1000;
  const jitter = 0.005; // ~500m
  const latOff = (seed - 0.5) * 2 * jitter;
  const lonOff = ((seed * 7) % 1 - 0.5) * 2 * jitter;
  return [lat + latOff, lon + lonOff];
}

interface Props {
  listings: ListingWithDistance[];
  myLat?: number;
  myLon?: number;
  /** When true, filter markers to visible map bounds (zoom to narrow) */
  filterByBounds?: boolean;
  /** Highlight and zoom to this user's listing */
  selectedUserId?: string;
  /** Called when a marker is clicked */
  onMarkerClick?: (userId: string) => void;
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

      map = L.map(el).setView(defaultCenter, 10);
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
        };
        if (typeof u.latitude !== "number" || typeof u.longitude !== "number") continue;
        const [lat, lon] = approximateCoords(u.latitude, u.longitude, u.id ?? "");
        if (props.filterByBounds && currentBounds && !currentBounds.contains([lat, lon])) continue;

        const isSelected = selectedId === u.id;
        if (isSelected) selectedLatLng = [lat, lon];

        const providerIcon = L.divIcon({
          className: "marker-provider",
          html: `<div style="width:${isSelected ? 28 : 20}px;height:${isSelected ? 28 : 20}px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [isSelected ? 28 : 20, isSelected ? 28 : 20],
          iconAnchor: [isSelected ? 14 : 10, isSelected ? 14 : 10],
        });

        const m = L.marker([lat, lon], { icon: providerIcon })
          .addTo(markerLayer!)
          .bindPopup(`<strong>${u.name || "Okänd"}</strong><br>${u.area || ""}<br><em>Ungefärlig plats</em>`);

        if (props.onMarkerClick && u.id) {
          m.on("click", () => props.onMarkerClick!(u.id!));
        }
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
      onMove = () => updateMarkers(map!.getBounds(), true);
      map.on("moveend", onMove);
      map.on("zoomend", onMove);
    }

    updateMarkers(props.filterByBounds && map ? map.getBounds() : null, false);

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
