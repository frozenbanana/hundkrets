import { createEffect, createSignal, onCleanup } from "solid-js";
import { configureLeafletDefaultIcons } from "~/lib/leafletIcons";

interface Props {
  lat: number;
  lon: number;
  zoom?: number;
  class?: string;
}

/** Leaflet-karta med zoom och pan (ingen redigering). */
export function ExcursionReadOnlyMap(props: Props) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  let map: import("leaflet").Map | null = null;
  let marker: import("leaflet").Marker | null = null;

  createEffect(() => {
    const el = mapRef();
    const lat = props.lat;
    const lon = props.lon;
    const zoom = props.zoom ?? 15;
    if (!el || typeof window === "undefined") return;

    if (map && marker) {
      marker.setLatLng([lat, lon]);
      map.setView([lat, lon], map.getZoom());
      return;
    }

    let cancelled = false;

    void (async () => {
      await import("leaflet/dist/leaflet.css");
      const L = await import("leaflet");
      if (cancelled || !el || map) return;
      configureLeafletDefaultIcons(L);

      map = L.map(el).setView([lat, lon], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      marker = L.marker([lat, lon]).addTo(map);
    })();

    onCleanup(() => {
      cancelled = true;
    });
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
      marker = null;
    }
  });

  return <div ref={setMapRef} class={props.class} />;
}
