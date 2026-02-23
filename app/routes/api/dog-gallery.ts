/**
 * Proxy for Dog CEO API – avoids CORS when fetching from browser.
 * GET /api/dog-gallery?count=12
 */
import type { APIEvent } from "@solidjs/start/server";

const DOG_CEO_BASE = "https://dog.ceo/api";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const count = Math.min(Math.max(1, parseInt(url.searchParams.get("count") ?? "12", 10) || 12), 50);

  try {
    const res = await fetch(`${DOG_CEO_BASE}/breeds/image/random/${count}`, {
      headers: { Accept: "application/json" },
    });
    const data = (await res.json()) as { message?: string | string[]; status?: string };
    if (data?.status === "success" && Array.isArray(data.message)) {
      const urls = data.message.filter((u): u is string => typeof u === "string");
      return new Response(JSON.stringify({ urls }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    /* fall through to fallback */
  }
  // Fallback when dog.ceo is down: placedog.net (no CORS needed for img src)
  const fallback = Array.from({ length: count }, (_, i) =>
    `https://placedog.net/300/200?id=${(i % 100) + 1}`
  );
  return new Response(JSON.stringify({ urls: fallback }), {
    headers: { "Content-Type": "application/json" },
  });
}
