/**
 * Hundkrets media Worker — R2 upload + delivery for media.hundkrets.se
 *
 * POST /v1/uploads          — auth + mint signed upload URL
 * PUT  /v1/objects/:key     — upload body (signed token)
 * GET  /o/:key              — serve object (public or members-gated)
 * GET  /health              — liveness
 */

export interface Env {
  MEDIA_BUCKET: R2Bucket;
  PB_URL: string;
  UPLOAD_SIGNING_SECRET: string;
  MIGRATE_SECRET?: string;
  MAX_IMAGE_BYTES?: string;
  MAX_VIDEO_BYTES?: string;
  /** R2 key prefix, e.g. "production" or "development" (matches bucket folders) */
  MEDIA_PREFIX?: string;
}

type Visibility = "public" | "members";
type Kind = "image" | "video";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Upload-Token, X-Migrate-Secret",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extra },
  });
}

function corsOk(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(sig);
}

async function mintUploadToken(
  secret: string,
  payload: {
    key: string;
    ownerId: string;
    kind: Kind;
    visibility: Visibility;
    contentType: string;
    maxBytes: number;
    exp: number;
  }
): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

async function verifyUploadToken(
  secret: string,
  token: string
): Promise<{
  key: string;
  ownerId: string;
  kind: Kind;
  visibility: Visibility;
  contentType: string;
  maxBytes: number;
  exp: number;
} | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = await hmacSign(secret, body);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload?.key || !payload?.ownerId || !payload?.exp) return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

async function authUserId(pbUrl: string, authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const res = await fetch(`${pbUrl.replace(/\/$/, "")}/api/collections/users/auth-refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { record?: { id?: string } };
    return data.record?.id ?? null;
  } catch {
    return null;
  }
}

function mediaPrefix(env: Env): string {
  const raw = (env.MEDIA_PREFIX || "production").trim().replace(/^\/+|\/+$/g, "");
  return raw || "production";
}

function buildObjectKey(env: Env, ownerId: string, id: string, ext: string): string {
  return `${mediaPrefix(env)}/users/${ownerId}/${id}.${ext}`;
}

function isAllowedObjectKey(env: Env, key: string): boolean {
  const prefix = `${mediaPrefix(env)}/users/`;
  return key.startsWith(prefix) && !key.includes("..");
}

function extForContentType(ct: string, kind: Kind): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[ct.toLowerCase()] ?? (kind === "video" ? "mp4" : "jpg");
}

function parseObjectKey(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  if (!raw || raw.includes("..")) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return corsOk();

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health" && request.method === "GET") {
      return json({ ok: true });
    }

    if (!env.MEDIA_BUCKET) {
      return json({ error: "MEDIA_BUCKET not configured" }, 503);
    }

    if (path === "/v1/uploads" && request.method === "POST") {
      return handleCreateUpload(request, env, url);
    }

    if (path.startsWith("/v1/objects/") && request.method === "PUT") {
      return handlePutObject(request, env, path);
    }

    if (path.startsWith("/o/") && request.method === "GET") {
      return handleGetObject(request, env, path);
    }

    // Migration helper: PUT with migrate secret (server-side script)
    if (path.startsWith("/v1/migrate/") && request.method === "PUT") {
      return handleMigratePut(request, env, path);
    }

    return json({ error: "Not found" }, 404);
  },
};

async function handleCreateUpload(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.UPLOAD_SIGNING_SECRET) {
    return json({ error: "UPLOAD_SIGNING_SECRET not configured" }, 503);
  }

  const ownerId = await authUserId(env.PB_URL, request.headers.get("Authorization"));
  if (!ownerId) return json({ error: "Unauthorized" }, 401);

  let body: {
    contentType?: string;
    kind?: Kind;
    byteLength?: number;
    visibility?: Visibility;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const kind = body.kind === "video" ? "video" : "image";
  const visibility: Visibility = body.visibility === "members" ? "members" : "public";
  const contentType = (body.contentType || "").toLowerCase().trim();
  const byteLength = Number(body.byteLength ?? 0);

  const maxImage = Number(env.MAX_IMAGE_BYTES || 5_242_880);
  const maxVideo = Number(env.MAX_VIDEO_BYTES || 26_214_400);
  const maxBytes = kind === "video" ? maxVideo : maxImage;

  const allowedImage = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  const allowedVideo = ["video/mp4", "video/webm", "video/quicktime"];
  const allowed = kind === "video" ? allowedVideo : allowedImage;
  if (!allowed.includes(contentType)) {
    return json({ error: `Unsupported content type: ${contentType}` }, 400);
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0 || byteLength > maxBytes) {
    return json({ error: `Invalid size (max ${maxBytes} bytes)` }, 400);
  }

  const id = crypto.randomUUID();
  const ext = extForContentType(contentType, kind);
  const objectKey = buildObjectKey(env, ownerId, id, ext);
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = await mintUploadToken(env.UPLOAD_SIGNING_SECRET, {
    key: objectKey,
    ownerId,
    kind,
    visibility,
    contentType,
    maxBytes,
    exp,
  });

  const origin = url.origin;
  const uploadUrl = `${origin}/v1/objects/${encodeURIComponent(objectKey)}`;
  const publicUrl = `${origin}/o/${encodeURIComponent(objectKey)}`;

  return json({
    objectKey,
    uploadUrl,
    uploadToken: token,
    url: publicUrl,
    expiresAt: exp,
  });
}

async function handlePutObject(request: Request, env: Env, path: string): Promise<Response> {
  if (!env.UPLOAD_SIGNING_SECRET) {
    return json({ error: "UPLOAD_SIGNING_SECRET not configured" }, 503);
  }

  const objectKey = parseObjectKey(path, "/v1/objects/");
  if (!objectKey) return json({ error: "Invalid key" }, 400);

  const token =
    request.headers.get("X-Upload-Token") ||
    new URL(request.url).searchParams.get("token") ||
    "";
  const payload = await verifyUploadToken(env.UPLOAD_SIGNING_SECRET, token);
  if (!payload || payload.key !== objectKey) {
    return json({ error: "Invalid or expired upload token" }, 403);
  }

  const contentType = (request.headers.get("Content-Type") || payload.contentType).toLowerCase();
  if (contentType.split(";")[0]!.trim() !== payload.contentType) {
    return json({ error: "Content-Type mismatch" }, 400);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > payload.maxBytes) {
    return json({ error: "Invalid body size" }, 400);
  }

  await env.MEDIA_BUCKET.put(objectKey, body, {
    httpMetadata: { contentType: payload.contentType },
    customMetadata: {
      ownerId: payload.ownerId,
      kind: payload.kind,
      visibility: payload.visibility,
    },
  });

  return json({ ok: true, objectKey, url: `/o/${encodeURIComponent(objectKey)}` }, 201);
}

async function handleMigratePut(request: Request, env: Env, path: string): Promise<Response> {
  const secret = env.MIGRATE_SECRET;
  if (!secret || request.headers.get("X-Migrate-Secret") !== secret) {
    return json({ error: "Forbidden" }, 403);
  }

  const objectKey = parseObjectKey(path, "/v1/migrate/");
  if (!objectKey || !isAllowedObjectKey(env, objectKey)) {
    return json({ error: "Invalid key" }, 400);
  }

  const contentType = (request.headers.get("Content-Type") || "application/octet-stream").toLowerCase();
  const visibility = (request.headers.get("X-Visibility") || "public") as Visibility;
  const ownerId = request.headers.get("X-Owner-Id") || "";
  const kind = (request.headers.get("X-Kind") || "image") as Kind;
  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: "Empty body" }, 400);

  await env.MEDIA_BUCKET.put(objectKey, body, {
    httpMetadata: { contentType },
    customMetadata: { ownerId, kind, visibility },
  });

  return json({ ok: true, objectKey }, 201);
}

async function handleGetObject(request: Request, env: Env, path: string): Promise<Response> {
  const objectKey = parseObjectKey(path, "/o/");
  if (!objectKey) return json({ error: "Invalid key" }, 400);

  const obj = await env.MEDIA_BUCKET.get(objectKey);
  if (!obj) return json({ error: "Not found" }, 404);

  const visibility = (obj.customMetadata?.visibility || "public") as Visibility;
  if (visibility === "members") {
    const userId = await authUserId(env.PB_URL, request.headers.get("Authorization"));
    if (!userId) {
      return json({ error: "Members only" }, 401, CORS_HEADERS);
    }
  }

  const headers = new Headers(CORS_HEADERS);
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", visibility === "public" ? "public, max-age=31536000, immutable" : "private, max-age=3600");
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");

  return new Response(obj.body, { status: 200, headers });
}
