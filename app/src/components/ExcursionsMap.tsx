import { createEffect, createSignal, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapBounds } from "~/lib/geocode";
import { excursionPreviewCoords, formatExcursionWhen } from "~/lib/excursionListCard";
import type { ExploreExcursionItem } from "~/lib/exploreExcursions";

function extractBounds(b: L.LatLngBounds): MapBounds {
  return {
    north: b.getNorth(),
    south: b.getSouth(),
    east: b.getEast(),
    west: b.getWest(),
  };
}

const BROWN_FILL = "#a0522d";
const PAST_FILL = "#8a8f99";

export type ExcursionsMapProps = {
  excursions: ExploreExcursionItem[];
  myLat?: number;
  myLon?: number;
  hoveredExcursionId?: string;
  filterByBounds?: boolean;
  onBoundsChange?: (bounds: MapBounds | null) => void;
  style?: Record<string, string>;
};

export function ExcursionsMap(props: ExcursionsMapProps) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  let map: L.Map | null = null;
  let markerLayer: L.LayerGroup | null = null;
  let prevEl: HTMLDivElement | null = null;
  let prevExcursions: ExploreExcursionItem[] | null = null;

  createEffect(() => {
    const el = mapRef();
    const excursions = props.excursions;
    const hoveredExcursionId = props.hoveredExcursionId;
    if (!el) return;

    const elChanged = prevEl !== el;
    const listChanged = prevExcursions !== excursions;
    if (map && (elChanged || listChanged)) {
      map.remove();
      map = null;
      markerLayer = null;
    }
    prevEl = el;
    prevExcursions = excursions;

    const hasCoords =
      typeof props.myLat === "number" && typeof props.myLon === "number";

    if (!map) {
      const defaultCenter: [number, number] = hasCoords
        ? [props.myLat!, props.myLon!]
        : [59.33, 18.07];

      map = L.map(el).setView(defaultCenter, 11);
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
          html: '<div style="width:22px;height:22px;background:#7cb342;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([props.myLat!, props.myLon!], { icon: meIcon })
          .addTo(markerLayer!)
          .bindPopup("<strong>Du</strong>");
      }

      const esc = (s: string) => s.replace(/</g, "&lt;").replace(/"/g, "&quot;");

      for (const ex of excursions) {
        const c = excursionPreviewCoords(
          ex.meeting_latitude,
          ex.meeting_longitude,
          ex.meeting_map_url
        );
        if (!c) continue;
        const { lat, lon } = c;
        if (props.filterByBounds && currentBounds && !currentBounds.contains([lat, lon])) continue;

        const when = formatExcursionWhen(ex.start_at);
        const startTs = new Date(ex.start_at).getTime();
        const isPast = !Number.isNaN(startTs) && startTs < Date.now();
        const detailUrl = `/app/excursions/${ex.id}`;
        const isHovered = hoveredExcursionId === ex.id;
        const statusText = isPast ? "Passerad" : "Kommande";
        const tooltipHtml = `
          <div class="map-tooltip-excursion">
            <strong>${esc(ex.title)}</strong><br />
            <span>${esc(when.date)} ${esc(when.time)} · ${esc(ex.meeting_area)} · ${statusText}</span>
          </div>
        `;
        const popupHtml = `
          <div class="map-popup-excursion">
            <strong class="map-popup-excursion-title">${esc(ex.title)}</strong>
            <p class="map-popup-excursion-meta">${esc(when.date)} ${esc(when.time)} · ${esc(ex.meeting_area)}</p>
            <p class="map-popup-excursion-meta">${statusText}</p>
            <a href="${detailUrl}" class="map-popup-link">Öppna hundträff</a>
          </div>
        `;
        const marker = L.circleMarker([lat, lon], {
          radius: isHovered ? 12 : 9,
          color: "#fff",
          weight: isHovered ? 3 : 2,
          fillColor: isPast ? PAST_FILL : BROWN_FILL,
          fillOpacity: isPast ? (isHovered ? 0.92 : 0.8) : isHovered ? 1 : 0.92,
        })
          .addTo(markerLayer!)
          .bindPopup(popupHtml, { className: "map-popup-excursion-wrap", closeButton: true });
        marker.bindTooltip(tooltipHtml, {
          direction: "top",
          offset: [0, -8],
          opacity: 0.95,
          className: "map-popup-excursion-wrap",
        });
        marker.on("mouseover", () => marker.openTooltip());
        marker.on("mouseout", () => marker.closeTooltip());
        if (isHovered) marker.bringToFront();
      }

      const layerCount = markerLayer.getLayers().length;
      if (!skipSetView) {
        if (layerCount > 1 && !currentBounds && map) {
          const layers = markerLayer.getLayers() as L.CircleMarker[];
          const latlngs = layers.map((m) => m.getLatLng());
          if (latlngs.length > 0) {
            const b = L.latLngBounds(latlngs);
            map.fitBounds(b.pad(0.12), { maxZoom: 13, animate: false });
          }
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
      updateMarkers(null, true);

      const allLayers = markerLayer!.getLayers() as (L.CircleMarker | L.Marker)[];
      const myPos = L.latLng(props.myLat!, props.myLon!);
      const otherPoints = allLayers
        .map((m) => m.getLatLng())
        .filter((ll) => ll.distanceTo(myPos) > 30)
        .sort((a, b) => a.distanceTo(myPos) - b.distanceTo(myPos));

      if (otherPoints.length > 0) {
        const nearest = otherPoints.slice(0, 8);
        nearest.push(myPos);
        map.fitBounds(L.latLngBounds(nearest).pad(0.12), { maxZoom: 12, animate: false });
      }

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
        marginTop: props.style?.["margin-top"] ?? "0",
      }}
    />
  );
}
