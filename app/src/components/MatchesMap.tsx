import { createEffect, createSignal, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ListingWithDistance } from "~/lib/matching";

interface Props {
  listings: ListingWithDistance[];
  myLat?: number;
  myLon?: number;
  style?: { height?: string; "border-radius"?: string; "margin-top"?: string };
}

export function MatchesMap(props: Props) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  let map: L.Map | null = null;

  createEffect(() => {
    const el = mapRef();
    const listings = props.listings;
    if (!el) return;

    if (map) {
      map.remove();
      map = null;
    }

    const hasCoords =
      typeof props.myLat === "number" && typeof props.myLon === "number";
    const defaultCenter: [number, number] = hasCoords
      ? [props.myLat!, props.myLon!]
      : [59.33, 18.07]; // Stockholm fallback

    map = L.map(el).setView(defaultCenter, 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markers: L.Marker[] = [];

    if (hasCoords) {
      const meIcon = L.divIcon({
        className: "marker-me",
        html: '<div style="width:24px;height:24px;background:#7cb342;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const meMarker = L.marker([props.myLat!, props.myLon!], { icon: meIcon })
        .addTo(map!)
        .bindPopup("<strong>Du</strong>");
      markers.push(meMarker);
    }

    const providerIcon = L.divIcon({
      className: "marker-provider",
      html: '<div style="width:20px;height:20px;background:#8b5a2b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    for (const listing of listings) {
      const u = listing.user as {
        latitude?: number;
        longitude?: number;
        name?: string;
        area?: string;
      };
      if (
        typeof u.latitude !== "number" ||
        typeof u.longitude !== "number"
      )
        continue;
      const m = L.marker([u.latitude, u.longitude], { icon: providerIcon })
        .addTo(map!)
        .bindPopup(`<strong>${u.name || "Okänd"}</strong><br>${u.area || ""}`);
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
    <div
      ref={setMapRef}
      style={{
        height: props.style?.height ?? "350px",
        width: "100%",
        borderRadius: props.style?.["border-radius"] ?? "var(--radius)",
        marginTop: props.style?.["margin-top"] ?? "1rem",
      }}
    />
  );
}
