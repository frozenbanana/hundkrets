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
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
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
 * Search for address suggestions. Debounce calls on your side (e.g. 300ms).
 */
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const params = new URLSearchParams({ q, limit: "10" });
  const res = await fetch(`${PHOTON_BASE}/api/?${params}`, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as PhotonResponse;
  return (data.features ?? []).map((f) => {
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

/**
 * Geocode a raw address string (e.g. on form submit if user didn't select from autocomplete).
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const results = await searchAddress(address);
  return results[0] ?? null;
}
