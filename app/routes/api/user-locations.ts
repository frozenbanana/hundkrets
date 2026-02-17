import type { APIEvent } from "@solidjs/start/server";

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090";
const ADMIN_TOKEN = import.meta.env.VITE_POCKETBASE_ADMIN_TOKEN;

export interface UserLocation {
  id: string;
  latitude: number;
  longitude: number;
  area?: string;
}

async function getAuthToken(): Promise<string | null> {
  if (ADMIN_TOKEN) {
    console.log("[user-locations] Using ADMIN_TOKEN");
    return ADMIN_TOKEN;
  }
 
  return null;
}

export async function GET(_event: APIEvent) {
  try {
    const token = await getAuthToken();
    const filter = encodeURIComponent("latitude != null && longitude != null");
    const url = `${PB_URL}/api/collections/users/records?filter=${filter}&fields=id,latitude,longitude,area&perPage=200`;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log("[user-locations] Users fetch failed:", res.status, await res.text());
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = (await res.json()) as { items?: UserLocation[] };
    const items = (data.items ?? []).filter(
      (u) => typeof u.latitude === "number" && typeof u.longitude === "number"
    );
    console.log("[user-locations] OK:", items.length, "users with coordinates");
    return new Response(JSON.stringify(items), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.log("[user-locations] Error:", err);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
