/**
 * Public profile API – fetches user, needs, capacities, dogs for display.
 * Prefer PB admin (for guests). Fall back to the caller's auth token so
 * logged-in users can open profiles even when PB_ADMIN_* is unset locally.
 * GET /api/users/:id/profile
 */
import type { APIEvent } from "@solidjs/start/server";
import PocketBase from "pocketbase";

const PB_URL =
  typeof process !== "undefined"
    ? process.env.POCKETBASE_SERVER_URL ||
      process.env.VITE_POCKETBASE_URL ||
      "http://127.0.0.1:8090"
    : "http://127.0.0.1:8090";

let cachedAdminPb: PocketBase | null = null;

async function getAdminPb(): Promise<PocketBase | null> {
  const email =
    process.env.PB_ADMIN_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL;
  const password =
    process.env.PB_ADMIN_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD;
  if (!email || !password) return null;
  if (cachedAdminPb?.authStore.isValid) return cachedAdminPb;
  const pb = new PocketBase(PB_URL);
  await pb.collection("_superusers").authWithPassword(email, password);
  cachedAdminPb = pb;
  return pb;
}

function getCallerPb(event: APIEvent): PocketBase | null {
  const auth =
    event.request.headers.get("authorization") ||
    event.request.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const pb = new PocketBase(PB_URL);
  pb.authStore.save(token, null);
  return pb;
}

async function getPbClient(event: APIEvent): Promise<PocketBase> {
  try {
    const admin = await getAdminPb();
    if (admin) return admin;
  } catch (err) {
    console.error("[profile API] admin auth failed", err);
  }
  const caller = getCallerPb(event);
  if (caller) return caller;
  throw new Error(
    "Profile API requires PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD or an authenticated request"
  );
}

function pickPublicUser(u: Record<string, unknown>): Record<string, unknown> {
  const allowed = ["id", "name", "avatar", "avatar_key", "area", "city", "neighborhood", "bio", "breeds_owned_before", "verified", "user_type"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in u && u[k] !== undefined) out[k] = u[k];
  }
  return out;
}

function pickPublicDog(d: Record<string, unknown>): Record<string, unknown> {
  const allowed = ["id", "name", "breed", "size", "gender", "age", "image", "image_key", "notes", "temperament_new_people", "temperament_new_dogs_female", "temperament_new_dogs_male"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in d && d[k] !== undefined) out[k] = d[k];
  }
  return out;
}

function pickPublicNeed(n: Record<string, unknown>): Record<string, unknown> {
  const allowed = ["id", "dog", "start_date", "end_date", "flexible_dates", "open_any_duration", "duration_specific", "notes"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in n && n[k] !== undefined) out[k] = n[k];
  }
  return out;
}

function pickPublicCapacity(c: Record<string, unknown>): Record<string, unknown> {
  const allowed = ["id", "start_date", "end_date", "flexible_dates", "open_any_duration", "duration_specific", "dog_sizes", "dog_genders", "max_dogs", "notes"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in c && c[k] !== undefined) out[k] = c[k];
  }
  return out;
}

export async function GET(event: APIEvent) {
  const id = event.params?.id;
  if (!id || typeof id !== "string") {
    return new Response(JSON.stringify({ error: "Missing user id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const pb = await getPbClient(event);

    const [user, needsRaw, capacitiesRaw] = await Promise.all([
      pb.collection("users").getOne(id).catch(() => null),
      pb.collection("watch_needs").getFullList({ filter: `user = "${id}"` }),
      pb.collection("watch_capacity").getFullList({ filter: `user = "${id}"` }),
    ]);

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const u = user as unknown as Record<string, unknown>;

    const needs = (needsRaw as Record<string, unknown>[]).map((n) => pickPublicNeed(n));

    const capacities = (capacitiesRaw as Record<string, unknown>[]).map((c) => pickPublicCapacity(c));

    const dogsList = await pb.collection("dogs").getFullList({ filter: `owner = "${id}"` });
    const dogs = (dogsList as Record<string, unknown>[]).map((d) => pickPublicDog(d));

    const payload = {
      user: pickPublicUser(u),
      needs,
      capacities,
      dogs,
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("[profile API]", err);
    const message = err instanceof Error ? err.message : "Failed to load profile";
    const isConfig =
      message.includes("PB_ADMIN") || message.includes("authenticated request");
    return new Response(
      JSON.stringify({
        error: isConfig
          ? "Failed to load profile (server missing admin config and no auth)"
          : "Failed to load profile",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
