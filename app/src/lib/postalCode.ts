/**
 * Swedish postal code lookup: city from postal_codes collection (CSV), area from user contributions.
 * Coordinates still from Photon (geocode.ts) for distance matching.
 */

const SWEDISH_POSTAL = /^\d{3}\s?\d{2}$/;

export interface PostalCodeLookup {
  postal_code: string;
  city: string;
  area: string | null;
}

function getPbUrl(): string {
  return import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
}

/**
 * Look up city and area for a Swedish postal code from postal_codes collection.
 */
export async function lookupPostalCode(postalCode: string): Promise<PostalCodeLookup | null> {
  const normalized = postalCode.replace(/\s/g, "").trim();
  if (!SWEDISH_POSTAL.test(normalized)) return null;

  const url = `${getPbUrl()}/api/collections/postal_codes/records?filter=postal_code='${encodeURIComponent(normalized)}'&perPage=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { items: { postal_code: string; city: string; area?: string }[] };
  const item = data.items?.[0];
  if (!item) return null;
  return {
    postal_code: item.postal_code,
    city: item.city ?? "",
    area: item.area && item.area.trim() ? item.area.trim() : null,
  };
}
