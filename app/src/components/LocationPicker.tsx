import { createEffect, createSignal, onCleanup } from "solid-js";
import { configureLeafletDefaultIcons } from "~/lib/leafletIcons";

interface Props {
  lat: number;
  lon: number;
  onChange: (lat: number, lon: number) => void;
  class?: string;
}

/**
 * Interactive Leaflet map with a draggable marker and a ~300 m radius circle.
 * Used in onboarding and profile editing so users can refine their approximate location.
 */
export function LocationPicker(props: Props) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = createSignal(false);
  let map: import("leaflet").Map | null = null;
  let marker: import("leaflet").Marker | null = null;
  let circle: import("leaflet").Circle | null = null;

  createEffect(() => {
    const el = mapRef();
    if (!el || map || typeof window === "undefined") return;

    let disposed = false;
    void (async () => {
      await import("leaflet/dist/leaflet.css");
      const L = await import("leaflet");
      if (disposed || !el || map) return;
      configureLeafletDefaultIcons(L);

      const lat = props.lat;
      const lon = props.lon;

      map = L.map(el).setView([lat, lon], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      circle = L.circle([lat, lon], {
        radius: 300,
        color: "var(--color-paw, #c45c3e)",
        fillColor: "var(--color-paw, #c45c3e)",
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map);

      marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        if (!marker) return;
        const p = marker.getLatLng();
        circle?.setLatLng(p);
        props.onChange(p.lat, p.lng);
      });

      map.on("click", (ev: { latlng: { lat: number; lng: number } }) => {
        marker?.setLatLng(ev.latlng);
        circle?.setLatLng(ev.latlng);
        props.onChange(ev.latlng.lat, ev.latlng.lng);
      });
      setMapReady(true);
    })();

    onCleanup(() => {
      disposed = true;
    });
  });

  createEffect(() => {
    const lat = props.lat;
    const lon = props.lon;
    const ready = mapReady();
    if (!ready || !map || !marker || !circle) return;
    if (typeof lat !== "number" || typeof lon !== "number") return;
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - lat) < 0.00001 && Math.abs(cur.lng - lon) < 0.00001) return;
    marker.setLatLng([lat, lon]);
    circle.setLatLng([lat, lon]);
    map.setView([lat, lon], map.getZoom());
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
      marker = null;
      circle = null;
      setMapReady(false);
    }
  });

  return <div ref={setMapRef} class={props.class ?? "location-picker"} />;
}
