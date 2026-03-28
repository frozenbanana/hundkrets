/**
 * Photon geocoding for address autocomplete and lookup.
 * Free OSM-based API, supports search-as-you-type.
 * https://photon.komoot.io/api?q=...
 */

const PHOTON_BASE = "https://photon.komoot.io";

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
  city?: string;
  neighborhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  name?: string;
  street?: string;
  osm_key?: string;
  osm_value?: string;
}

interface PhotonFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    locality?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function buildDisplayName(f: PhotonFeature): string {
  const p = f.properties;
  if (!p) return "Unknown";
  const parts: string[] = [];
  if (p.housenumber && p.street) parts.push(`${p.street} ${p.housenumber}`);
  else if (p.street) parts.push(p.street);
  if (p.district) parts.push(p.district);
  if (p.city) parts.push(p.city);
  if (p.state && p.state !== p.city) parts.push(p.state);
  if (p.postcode) parts.push(p.postcode);
  if (p.country) parts.push(p.country);
  if (parts.length > 0) return parts.join(", ");
  return p.name ?? "Unknown";
}

/**
 * Search for Swedish cities. Use for city picker.
 */
export async function searchCitiesSweden(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q || q.length < 3) return [];

  const params = new URLSearchParams({
    q: `${q} Sverige`,
    limit: "8",
  });
  const res = await fetch(`${PHOTON_BASE}/api/?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as PhotonResponse;
  const all = (data.features ?? []).filter(
    (f) => (f.properties?.countrycode ?? "").toUpperCase() === "SE"
  );
  // Prefer places (cities, municipalities) over addresses for city picker
  const placeTypes = ["place", "boundary"];
  const features = [
    ...all.filter((f) => placeTypes.includes(f.properties?.osm_key ?? "")),
    ...all.filter((f) => !placeTypes.includes(f.properties?.osm_key ?? "")),
  ];
  return features.slice(0, 5).map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties ?? {};
    const city = p.city ?? p.name ?? p.state;
    return {
      display_name: p.name ?? city ?? "Unknown",
      lat,
      lon,
      city,
      neighborhood: p.district,
      suburb: p.district,
      village: p.city,
      town: p.city,
      name: p.name,
      street: p.street,
      osm_key: p.osm_key,
      osm_value: p.osm_value,
    };
  });
}

/**
 * Search for address suggestions in Sweden. Pass city to scope street search.
 */
export async function searchAddress(query: string, options?: { city?: string }): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q || q.length < 3) return [];

  const searchQuery = options?.city ? `${q}, ${options.city}, Sverige` : `${q} Sverige`;
  const params = new URLSearchParams({
    q: searchQuery,
    limit: "15",
  });
  const res = await fetch(`${PHOTON_BASE}/api/?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as PhotonResponse;
  let features = (data.features ?? []).filter(
    (f) => (f.properties?.countrycode ?? "").toUpperCase() === "SE"
  );
  // When city is specified, keep only results in that city (Photon may return other cities)
  if (options?.city) {
    const cityLower = options.city.toLowerCase().trim();
    features = features.filter((f) => {
      const fCity = (f.properties?.city ?? f.properties?.locality ?? "").toLowerCase();
      if (!fCity) return false;
      return fCity === cityLower || fCity.includes(cityLower) || cityLower.includes(fCity);
    });
  }
  return features.slice(0, 5).map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties ?? {};
    const city = p.city ?? p.state;
    const neighborhood = p.district ?? p.city;
    return {
      display_name: buildDisplayName(f),
      lat,
      lon,
      city,
      neighborhood,
      suburb: p.district,
      village: p.city,
      town: p.city,
      name: p.name,
      street: p.street,
      osm_key: p.osm_key,
      osm_value: p.osm_value,
    };
  });
}

/** ~500m jitter for privacy—approximate location only. Deterministic per userId. */
export function approximateCoords(lat: number, lon: number, userId: string): [number, number] {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h << 5) - h + userId.charCodeAt(i);
  const seed = Math.abs(h % 1000) / 1000;
  const jitter = 0.005; // ~500m
  const latOff = (seed - 0.5) * 2 * jitter;
  const lonOff = ((seed * 7) % 1 - 0.5) * 2 * jitter;
  return [lat + latOff, lon + lonOff];
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Check if a point is inside bounds (inclusive). */
export function pointInBounds(lat: number, lon: number, bounds: MapBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}

/**
 * Geocode a raw address string (e.g. on form submit if user didn't select from autocomplete).
 */
export async function geocodeAddress(address: string, city?: string): Promise<GeocodeResult | null> {
  const results = await searchAddress(address, city ? { city } : undefined);
  return results[0] ?? null;
}

/**
 * Geocode a Swedish city name and return the best city/place candidate.
 * Intended as a safe fallback when a postal code is unknown.
 */
export async function geocodeCity(city: string): Promise<GeocodeResult | null> {
  const q = city.trim();
  if (!q) return null;
  const results = await searchCitiesSweden(q);
  if (results.length === 0) return null;
  const qNorm = normalizeSearchText(q);
  const exact = results.find((r) => normalizeSearchText(r.display_name ?? "") === qNorm);
  return exact ?? results[0] ?? null;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMeetingCandidate(
  queryNorm: string,
  queryTokens: string[],
  cityHintNorm: string,
  candidate: GeocodeResult
): number {
  const label = normalizeSearchText(candidate.display_name ?? "");
  const name = normalizeSearchText(candidate.name ?? "");
  const street = normalizeSearchText(candidate.street ?? "");
  const city = normalizeSearchText(candidate.city ?? "");
  const neighborhood = normalizeSearchText(
    candidate.neighborhood ?? candidate.suburb ?? candidate.village ?? candidate.town ?? ""
  );
  const hay = `${label} ${city} ${neighborhood}`.trim();
  if (!hay) return Number.NEGATIVE_INFINITY;

  const osmKey = normalizeSearchText(candidate.osm_key ?? "");
  const osmValue = normalizeSearchText(candidate.osm_value ?? "");
  const isLikelyPlaceName = queryTokens.length <= 3 && !/\d/.test(queryNorm);
  const exactNameMatch =
    Boolean(name) && (name === queryNorm || name.startsWith(`${queryNorm} `) || name.includes(` ${queryNorm}`));
  const naturalLike =
    osmKey === "natural" ||
    osmKey === "water" ||
    osmValue === "lake" ||
    osmValue === "water" ||
    osmValue === "reservoir" ||
    osmValue === "wetland";
  const streetLike =
    Boolean(street) ||
    osmKey === "highway" ||
    osmValue === "residential" ||
    osmValue === "road" ||
    osmValue === "service" ||
    osmValue === "footway";

  let score = 0;
  if (exactNameMatch) score += 240;
  if (hay.includes(queryNorm)) score += 120;
  if (label.startsWith(queryNorm)) score += 25;
  if (isLikelyPlaceName && naturalLike) score += 120;
  if (isLikelyPlaceName && streetLike && !exactNameMatch) score -= 130;
  if (cityHintNorm && city && (city.includes(cityHintNorm) || cityHintNorm.includes(city))) score += 12;

  let matchedTokens = 0;
  for (const token of queryTokens) {
    if (hay.includes(token)) {
      score += 24;
      matchedTokens += 1;
    }
  }
  if (queryTokens.length > 0 && matchedTokens === 0) score -= 100;

  return score;
}

/**
 * Geocode a meeting place / area string and rank candidates by textual relevance.
 * This avoids city-scoped false positives (e.g. "Vombsjon" ending up in central Malmo).
 */
export async function geocodeMeetingArea(
  area: string,
  options?: { cityHint?: string }
): Promise<GeocodeResult | null> {
  const q = area.trim();
  if (!q) return null;

  const queryNorm = normalizeSearchText(q);
  const queryTokens = queryNorm.split(" ").filter((t) => t.length >= 2);
  const cityHintNorm = normalizeSearchText(options?.cityHint ?? "");

  const buckets = await Promise.all([
    searchAddress(q, options?.cityHint ? { city: options.cityHint } : undefined).catch(
      () => [] as GeocodeResult[]
    ),
    searchAddress(q).catch(() => [] as GeocodeResult[]),
    searchCitiesSweden(q).catch(() => [] as GeocodeResult[]),
  ]);

  const deduped = new Map<string, GeocodeResult>();
  for (const bucket of buckets) {
    for (const candidate of bucket) {
      const key = `${candidate.lat.toFixed(5)},${candidate.lon.toFixed(5)}`;
      if (!deduped.has(key)) deduped.set(key, candidate);
    }
  }
  const candidates = [...deduped.values()];
  if (candidates.length === 0) return null;

  let best: GeocodeResult | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const score = scoreMeetingCandidate(queryNorm, queryTokens, cityHintNorm, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best ?? candidates[0] ?? null;
}

/** Swedish postal code format: 123 45 or 12345 */
const SWEDISH_POSTAL = /^\d{3}\s?\d{2}$/;

/**
 * Geocode a Swedish postal code to get coordinates and city/area.
 * Uses Photon. When city is provided (e.g. from postal_codes CSV), include it in the query
 * so Photon returns the correct location instead of random Swedish places.
 */
export async function geocodePostalCode(
  postalCode: string,
  options?: { city?: string }
): Promise<GeocodeResult | null> {
  const normalized = postalCode.replace(/\s/g, "").trim();
  if (!SWEDISH_POSTAL.test(normalized)) return null;
  const formatted = `${normalized.slice(0, 3)} ${normalized.slice(3)}`;

  const query = options?.city?.trim()
    ? `${formatted} ${options.city.trim()} Sverige`
    : `${formatted} Sverige`;

  const params = new URLSearchParams({
    q: query,
    limit: "10",
  });
  const res = await fetch(`${PHOTON_BASE}/api/?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as PhotonResponse;
  const features = (data.features ?? []).filter(
    (f) => (f.properties?.countrycode ?? "").toUpperCase() === "SE"
  );
  // Prefer results with matching postcode in properties
  const matching = features.filter(
    (f) => (f.properties?.postcode ?? "").replace(/\s/g, "") === normalized
  );
  const toUse = matching.length > 0 ? matching : features;
  const f = toUse[0];
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties ?? {};
  const city = p.city ?? p.locality ?? p.state ?? p.name ?? "";
  const neighborhood = p.district ?? p.city ?? "";
  const area = city || neighborhood || p.name || "Unknown";
  return {
    display_name: `${formatted} ${area}`.trim(),
    lat,
    lon,
    city,
    neighborhood,
    suburb: p.district,
    village: p.city,
    town: p.city,
  };
}
