import type { ExcursionVisibility } from "~/types";

export const EXCURSION_VISIBILITY_LABELS: Record<ExcursionVisibility, string> = {
  public: "Publik",
  matched_only: "Ömsesidigt matchade",
  interested_by_me: "De jag visat intresse för",
};

/** OSM static map thumbnail (no API key). */
export function excursionMapThumbUrl(lat?: number, lon?: number): string | null {
  if (typeof lat !== "number" || typeof lon !== "number" || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const latR = Math.round(lat * 1e5) / 1e5;
  const lonR = Math.round(lon * 1e5) / 1e5;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latR},${lonR}&zoom=14&size=240x144&maptype=mapnik`;
}

export function formatExcursionCardWhen(iso: string): { weekday: string; datePart: string; timePart: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { weekday: "", datePart: iso, timePart: "" };
  }
  const weekday = new Intl.DateTimeFormat("sv-SE", { weekday: "short" }).format(d);
  const datePart = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(d);
  const timePart = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" }).format(d);
  return { weekday, datePart, timePart };
}

export function formatExcursionDurationShort(hours?: number): string {
  if (typeof hours !== "number" || Number.isNaN(hours) || hours <= 0) return "2 tim";
  const rounded = Number.isInteger(hours) ? hours : Number(hours.toFixed(1));
  return `${rounded} ${rounded === 1 ? "tim" : "tim"}`;
}
