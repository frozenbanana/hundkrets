import { createEffect, createSignal, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { approximateCoords } from "~/lib/geocode";

interface UserLocation {
  id: string;
  latitude: number;
  longitude: number;
  area?: string;
}

/** Demo markers when no users—Swedish cities */
const DEMO_MARKERS: UserLocation[] = [
  { id: "demo-1", latitude: 55.605, longitude: 13.0038, area: "Malmö" },
  { id: "demo-2", latitude: 59.3293, longitude: 18.0686, area: "Stockholm" },
  { id: "demo-3", latitude: 57.7089, longitude: 11.9746, area: "Göteborg" },
  { id: "demo-4", latitude: 55.6761, longitude: 12.5683, area: "Köpenhamn" },
];

interface Props {
  style?: Record<string, string>;
}

export function LandingMap(props: Props) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  const [users, setUsers] = createSignal<UserLocation[]>(DEMO_MARKERS);
  let map: L.Map | null = null;
  let markerLayer: L.LayerGroup | null = null;

  createEffect(() => {
    fetch("/api/user-locations")
      .then((r) => r.json())
      .then((data: UserLocation[]) => setUsers(data.length > 0 ? data : DEMO_MARKERS))
      .catch(() => setUsers(DEMO_MARKERS));
  });

  createEffect(() => {
    const el = mapRef();
    const userList = users();
    if (!el) return;

    if (!map) {
      map = L.map(el, {
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        dragging: false,
      }).setView([59.33, 18.07], 3);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      markerLayer = L.layerGroup().addTo(map);
    }

    if (!markerLayer || !map) return;
    markerLayer.clearLayers();

    const markers: L.LatLng[] = [];
    for (const u of userList) {
      const [lat, lon] = approximateCoords(u.latitude, u.longitude, u.id);
      markers.push(L.latLng(lat, lon));
      const icon = L.divIcon({
        className: "marker-provider",
        html: '<div style="width:12px;height:12px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([lat, lon], { icon })
        .addTo(markerLayer!)
        .bindTooltip(u.area || "Hundägare", { permanent: false });
    }

    if (markers.length > 1) {
      const lats = markers.map((m) => m.lat).sort((a, b) => a - b);
      const lons = markers.map((m) => m.lng).sort((a, b) => a - b);
      const mid = Math.floor(markers.length / 2);
      const medianLat = markers.length % 2 ? lats[mid] : (lats[mid - 1] + lats[mid]) / 2;
      const medianLon = markers.length % 2 ? lons[mid] : (lons[mid - 1] + lons[mid]) / 2;
      const withDist = markers.map((m) => ({
        m,
        d: (m.lat - medianLat) ** 2 + (m.lng - medianLon) ** 2,
      }));
      withDist.sort((a, b) => a.d - b.d);
      const coreCount = Math.max(1, Math.ceil(markers.length * 0.5));
      const coreMarkers = withDist.slice(0, coreCount).map((x) => x.m);
      const b = L.latLngBounds(coreMarkers);
      map.fitBounds(b.pad(0.2));
    } else if (markers.length === 1) {
      map.setView(markers[0], 10);
    }

    return () => {};
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
      markerLayer = null;
    }
  });

  return (
    <div class="landing-map-wrapper">
      <p class="landing-map-caption">
        {users().length > 0
          ? "Hundägare som använder Hundkrets"
          : "Hundägare i Sverige—bli en av dem"}
      </p>
      <div
        ref={setMapRef}
        class="landing-map"
        style={{
          height: props.style?.height ?? "280px",
          minHeight: props.style?.["min-height"],
          width: "100%",
          borderRadius: props.style?.["border-radius"] ?? "var(--radius)",
          marginTop: props.style?.["margin-top"] ?? "1rem",
        }}
      />
    </div>
  );
}
