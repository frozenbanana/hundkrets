import type { findListings } from "~/lib/matching";

export const DEFAULT_MAX_DISTANCE_KM = 100;

export function formatDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

export function dateStr(n: {
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  start_date?: string;
  end_date?: string;
}) {
  if (!n.flexible_dates && n.start_date && n.end_date) {
    return `${formatDate(n.start_date)} – ${formatDate(n.end_date)}`;
  }
  if (n.flexible_dates) {
    if (n.open_any_duration !== false) return "Flexibel, valfri längd";
    return n.duration_specific ? `Flexibel: ${n.duration_specific}` : "Flexibel";
  }
  return "—";
}

export const genderLabel: Record<string, string> = { male: "hane", female: "tik", any: "Alla" };
export const sizeLabel: Record<string, string> = { small: "Liten", medium: "Mellan", large: "Stor" };
export const temperamentLabel: Record<string, string> = {
  friendly: "Vänlig",
  cautious: "Försiktig",
  shy: "Blyg",
  reactive: "Reaktiv",
  neutral: "Neutral",
  unknown: "Okänd",
};

export function datesOverlap(
  aStart: string | undefined,
  aEnd: string | undefined,
  bStart: string | undefined,
  bEnd: string | undefined
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  const aS = new Date(aStart).getTime();
  const aE = new Date(aEnd).getTime();
  const bS = new Date(bStart).getTime();
  const bE = new Date(bEnd).getTime();
  if (isNaN(aS) || isNaN(aE) || isNaN(bS) || isNaN(bE)) return false;
  return aS <= bE && bS <= aE;
}

export function canPassStr(s: string | string[] | undefined): string {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  const hasSmall = arr.includes("small");
  const hasMedium = arr.includes("medium");
  const hasLarge = arr.includes("large");
  if (arr.includes("any") || (hasSmall && hasMedium && hasLarge)) return "alla storlekar";
  if (hasSmall && !hasMedium && !hasLarge) return "små hundar";
  if (hasSmall && hasMedium && !hasLarge) return "upp till mellanstora hundar";
  if (hasSmall && hasMedium && hasLarge) return "upp till stora hundar";
  if (hasMedium && !hasSmall && !hasLarge) return "bara mellanstora hundar";
  if (hasMedium && hasLarge && !hasSmall) return "upp till stora hundar";
  if (hasLarge && !hasSmall && !hasMedium) return "bara stora hundar";
  return arr.map((x) => sizeLabel[x] ?? x).join(", ");
}

export function sizesStr(s: string | string[] | undefined): string {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  if (arr.length >= 3) return "Alla storlekar";
  return arr.map((x) => sizeLabel[x] ?? x.charAt(0).toUpperCase() + x.slice(1)).join(", ");
}

export type MatchFilter = "all" | "matched" | "not_matched" | "requested_me" | "outgoing";

export type MatchSort = "distance" | "recent" | "active";

export function canPassMyDog(listing: ListingItem): boolean {
  return listing.capacities.length > 0;
}

/** Returns "Inloggad senast X minuter/timmar/dagar sedan" or "" if null/undefined */
export function formatLastLoginAgo(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = Date.now();
  const ms = now - d.getTime();
  const min = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (min < 1) return "Inloggad nyligen";
  if (min < 60) return `Inloggad senast ${min} ${min === 1 ? "minut" : "minuter"} sedan`;
  if (hours < 24) return `Inloggad senast ${hours} ${hours === 1 ? "timme" : "timmar"} sedan`;
  if (days < 7) return `Inloggad senast ${days} ${days === 1 ? "dag" : "dagar"} sedan`;
  return `Inloggad senast ${days} dagar sedan`;
}

export type ExcludeType = "give" | "mutual" | "receive";

export function filterFromParams(params: {
  match?: string;
  not_matched?: string;
  request?: string;
  outgoing?: string;
  pass?: string;
  exclude_give?: string;
  exclude_mutual?: string;
  exclude_receive?: string;
  sort?: string;
}): { filter: MatchFilter; excludeGive: boolean; excludeMutual: boolean; excludeReceive: boolean; sort: MatchSort } {
  let filter: MatchFilter = "all";
  if (params.request === "true" || params.request === "1") filter = "requested_me";
  else if (params.outgoing === "true" || params.outgoing === "1") filter = "outgoing";
  else if (params.match === "true" || params.match === "1") filter = "matched";
  else if (params.not_matched === "true" || params.not_matched === "1") filter = "not_matched";

  const excludeGive = params.exclude_give === "true" || params.exclude_give === "1";
  const excludeMutual = params.exclude_mutual === "true" || params.exclude_mutual === "1";
  const excludeReceive = params.exclude_receive === "true" || params.exclude_receive === "1" || params.pass === "true" || params.pass === "1";

  let sort: MatchSort = "active";
  if (params.sort === "distance") sort = "distance";
  else if (params.sort === "recent") sort = "recent";
  else if (params.sort === "active") sort = "active";

  return { filter, excludeGive, excludeMutual, excludeReceive, sort };
}

export function filterToParams(filter: MatchFilter): Record<string, string> {
  const next: Record<string, string> = {};
  if (filter === "matched") next.match = "true";
  else if (filter === "not_matched") next.not_matched = "true";
  else if (filter === "requested_me") next.request = "true";
  else if (filter === "outgoing") next.outgoing = "true";
  return next;
}

export function buildMatchesParams(opts: {
  filter: MatchFilter;
  excludeGive?: boolean;
  excludeMutual?: boolean;
  excludeReceive?: boolean;
  sort?: MatchSort;
  user?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  const fp = filterToParams(opts.filter);
  for (const [k, v] of Object.entries(fp)) {
    if (v) params[k] = v;
  }
  if (opts.excludeGive) params.exclude_give = "true";
  if (opts.excludeMutual) params.exclude_mutual = "true";
  if (opts.excludeReceive) params.exclude_receive = "true";
  if (opts.sort && opts.sort !== "active") params.sort = opts.sort;
  if (opts.user) params.user = opts.user;
  return params;
}

export function buildMatchesUrl(opts: {
  filter: MatchFilter;
  excludeGive?: boolean;
  excludeMutual?: boolean;
  excludeReceive?: boolean;
  sort?: MatchSort;
  user?: string;
}): string {
  const params = buildMatchesParams(opts);
  const qs = new URLSearchParams(params).toString();
  return `/app/explore${qs ? "?" + qs : ""}`;
}

export type ListingItem = ReturnType<typeof findListings>[number];

export function getFirstDog(listing: ListingItem) {
  const firstNeed = listing.needs[0];
  if (firstNeed) {
    const dog = listing.dogs.find((d) => d.id === firstNeed.dog);
    return dog;
  }
  return listing.dogs[0];
}

export function isPassOnly(listing: ListingItem): boolean {
  return listing.dogs.length === 0 && listing.needs.length === 0 && listing.capacities.length > 0;
}

export function isNeedOnly(listing: ListingItem): boolean {
  return listing.needs.length > 0 && listing.capacities.length === 0;
}

/** "mutual" = behov + kapacitet, "receive" = endast behov, "give" = endast kapacitet */
export function getExchangeType(
  listing: ListingItem
): "mutual" | "receive" | "give" | null {
  const hasNeeds = listing.needs.length > 0;
  const hasCapacity = listing.capacities.length > 0;
  if (hasNeeds && hasCapacity) return "mutual";
  if (hasNeeds && !hasCapacity) return "receive";
  if (!hasNeeds && hasCapacity) return "give";
  return null;
}
