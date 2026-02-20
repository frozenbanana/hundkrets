import type { APIEvent } from "@solidjs/start/server";

const PB_URL = import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090";

export interface UserLocation {
  id: string;
  latitude: number;
  longitude: number;
  area?: string;
}

function getAuthToken(): string | null {
  return process.env.VITE_POCKETBASE_SERVICE_TOKEN || import.meta.env.VITE_POCKETBASE_SERVICE_TOKEN || null;
}

export async function GET(_event: APIEvent) {
  console.log("[user-locations] GET request received");
  try {
    const token = getAuthToken();
    if (!token) console.log("[user-locations] No VITE_POCKETBASE_SERVICE_TOKEN in app/.env – fetch will fail");
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
