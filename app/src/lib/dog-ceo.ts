/**
 * Dog CEO API: https://dog.ceo/dog-api/documentation/breed
 * Returns a random dog image URL for a breed, or fallback random image.
 */

const DOG_CEO_BASE = "https://dog.ceo/api";

/** Map common breed names to Dog CEO API path (breed or breed/subbreed) */
const BREED_MAP: Record<string, string> = {
  "golden retriever": "retriever/golden",
  labrador: "labrador",
  "cocker spaniel": "spaniel/cocker",
  "german shepherd": "german/shepherd",
  schäfer: "german/shepherd",
  beagle: "beagle",
  "border collie": "collie/border",
  husky: "husky",
  poodle: "poodle",
  pudel: "poodle",
  "cavalier king charles spaniel": "spaniel/cocker",
  cavalier: "spaniel/cocker",
  "cavalier spaniel": "spaniel/cocker",
  blandras: "mix",
  mix: "mix",
  "english springer spaniel": "springer/english",
  "welsh corgi": "corgi/cardigan",
  "pembroke welsh corgi": "pembroke",
  dachshund: "dachshund",
  boxer: "boxer",
  rottweiler: "rottweiler",
  "australian shepherd": "australian/shepherd",
  "yorkshire terrier": "terrier/yorkshire",
  "siberian husky": "husky",
  doberman: "doberman",
  "shih tzu": "shihtzu",
  "miniature schnauzer": "schnauzer/miniature",
  chihuahua: "chihuahua",
  pomeranian: "pomeranian",
  "boston terrier": "bulldog/boston",
  havanese: "havanese",
  "great dane": "dane/great"
};

/** Exported for testing. Maps breed names to Dog CEO API path. */
export function toApiPath(breed: string): string | null {
  const normalized = breed.trim().toLowerCase();
  if (!normalized) return null;
  const mapped = BREED_MAP[normalized];
  if (mapped) return mapped;
  const slug = normalized.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return slug || null;
}

export async function fetchBreedImageUrl(breed: string | undefined): Promise<string | null> {
  const path = breed ? toApiPath(breed) : null;
  const url = path
    ? `${DOG_CEO_BASE}/breed/${path}/images/random`
    : `${DOG_CEO_BASE}/breeds/image/random`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as { message?: string; status?: string };
    if (data?.status === "success" && typeof data.message === "string") {
      return data.message;
    }
  } catch {
    // Fallback to random if breed-specific fails
    if (path) {
      try {
        const fallback = await fetch(`${DOG_CEO_BASE}/breeds/image/random`);
        const data = (await fallback.json()) as { message?: string; status?: string };
        if (data?.status === "success" && typeof data.message === "string") {
          return data.message;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

/** Fetch multiple random dog image URLs for gallery display. Uses our API proxy to avoid CORS. */
export async function fetchMultipleRandomDogs(count: number = 12): Promise<string[]> {
  try {
    const res = await fetch(`/api/dog-gallery?count=${Math.min(count, 50)}`);
    const data = (await res.json()) as { urls?: string[] };
    if (Array.isArray(data?.urls)) {
      return data.urls.filter((u): u is string => typeof u === "string");
    }
  } catch {
    /* ignore */
  }
  return [];
}

const PB_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_POCKETBASE_URL
  ? import.meta.env.VITE_POCKETBASE_URL
  : "http://localhost:8090";

/** Fetch dog image URLs from database (dogs with images). Returns full file URLs. */
export async function fetchDogImagesFromDb(): Promise<string[]> {
  try {
    const res = await fetch(`${PB_URL}/api/hundkrets/dog-gallery`);
    const data = (await res.json()) as Array<{ id?: string; image?: string }>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((d) => d?.id && d?.image)
      .map((d) => `${PB_URL}/api/files/dogs/${d.id}/${d.image}`);
  } catch {
    return [];
  }
}

/** Fetch gallery images: DB first, dog.ceo API as fallback. Pads with API if DB has fewer than count. */
export async function fetchGalleryDogImages(count: number = 12): Promise<string[]> {
  const fromDb = await fetchDogImagesFromDb();
  if (fromDb.length >= count) return fromDb.slice(0, count);
  if (fromDb.length > 0) {
    const pad = await fetchMultipleRandomDogs(count - fromDb.length);
    return [...fromDb, ...pad];
  }
  return fetchMultipleRandomDogs(count);
}
