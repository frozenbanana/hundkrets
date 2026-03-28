import type { ExcursionVisibility } from "~/types";

export const EXCURSION_VISIBILITY_LABELS: Record<ExcursionVisibility, string> = {
  public: "Publik",
  matched_only: "Ömsesidigt matchade",
  interested_by_me: "De jag visat intresse för",
};

/** Parse lat/lon from common Google Maps share URLs. */
export function coordsFromMapsUrl(url?: string): { lat: number; lon: number } | undefined {
  if (!url || typeof url !== "string") return undefined;
  try {
    const u = new URL(url, "https://www.google.com");
    const tryPair = (raw: string) => {
      const trimmed = decodeURIComponent(raw).trim();
      const m = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      if (!m) return undefined;
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return undefined;
      return { lat, lon };
    };
    for (const key of ["q", "query", "ll"]) {
      const q = u.searchParams.get(key);
      if (q) {
        const pair = tryPair(q);
        if (pair) return pair;
      }
    }
    const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (at) {
      const lat = parseFloat(at[1]);
      const lon = parseFloat(at[2]);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

const OSM_TILE = 256;

function worldPixelXY(lat: number, lon: number, z: number): { x: number; y: number } {
  const zz = Math.max(0, Math.min(19, Math.floor(z)));
  const scale = OSM_TILE * 2 ** zz;
  const x = ((lon + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

function osmTileUrlForPixel(tileX: number, tileY: number, z: number): string {
  const zz = Math.max(0, Math.min(19, Math.floor(z)));
  return `https://tile.openstreetmap.org/${zz}/${tileX}/${tileY}.png`;
}

/** Resolved coordinates for preview (same rules as list cards). */
export function excursionPreviewCoords(
  lat?: number,
  lon?: number,
  meetingMapUrl?: string
): { lat: number; lon: number } | undefined {
  let la = lat;
  let lo = lon;
  if (coordsMissingOrZero(la, lo)) {
    const parsed = coordsFromMapsUrl(meetingMapUrl);
    if (parsed) {
      la = parsed.lat;
      lo = parsed.lon;
    }
  }
  if (la == null || lo == null || Number.isNaN(la) || Number.isNaN(lo)) return undefined;
  if (la === 0 && lo === 0) return undefined;
  return { lat: la, lon: lo };
}

/**
 * One OSM tile plus pixel offsets so (lat, lon) sits at the “map center” under a pin.
 */
export function excursionPreviewMapLayout(
  lat?: number,
  lon?: number,
  meetingMapUrl?: string,
  z = 14
): { tileUrl: string; offsetX: number; offsetY: number } | undefined {
  const c = excursionPreviewCoords(lat, lon, meetingMapUrl);
  if (!c) return undefined;
  const { x, y } = worldPixelXY(c.lat, c.lon, z);
  const tileX = Math.floor(x / OSM_TILE);
  const tileY = Math.floor(y / OSM_TILE);
  const offsetX = x - tileX * OSM_TILE;
  const offsetY = y - tileY * OSM_TILE;
  return {
    tileUrl: osmTileUrlForPixel(tileX, tileY, z),
    offsetX,
    offsetY,
  };
}

function coordsMissingOrZero(lat?: number, lon?: number): boolean {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return true;
  return lat === 0 && lon === 0;
}

/** Tile URL only (tests / simple img use). */
export function excursionPreviewMapSrc(
  lat?: number,
  lon?: number,
  meetingMapUrl?: string
): string | undefined {
  return excursionPreviewMapLayout(lat, lon, meetingMapUrl, 14)?.tileUrl;
}

export function formatExcursionWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  const date = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(d);
  return { date, time };
}

export function formatExcursionDurationHours(hours?: number): string {
  if (typeof hours !== "number" || Number.isNaN(hours) || hours <= 0) return "2 timmar";
  const rounded = Number.isInteger(hours) ? hours : Number(hours.toFixed(1));
  return `${rounded} ${rounded === 1 ? "timme" : "timmar"}`;
}

export function excursionVisibilityBadgeClass(visibility: ExcursionVisibility): string {
  return `excursions-card-badge--vis-${visibility}`;
}
