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
