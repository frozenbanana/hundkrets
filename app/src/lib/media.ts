import { pb } from "~/lib/pocketbase";

export const MAX_VIDEO_DURATION_MS = 15_000;
export const MAX_VIDEO_SIZE_BYTES = 26_214_400;
export const MAX_MEDIA_IMAGE_BYTES = 5_242_880;

export type MediaKind = "image" | "video";
export type MediaVisibility = "public" | "members";

export type MediaRecord = {
  id: string;
  owner: string;
  kind: MediaKind;
  object_key: string;
  poster_key?: string;
  visibility: MediaVisibility;
  duration_ms?: number;
  width?: number;
  height?: number;
  created?: string;
  updated?: string;
};

export function mediaBaseUrl(): string {
  const raw =
    (typeof import.meta !== "undefined" &&
      (import.meta as { env?: { VITE_MEDIA_URL?: string } }).env?.VITE_MEDIA_URL) ||
    "";
  return (raw || "").replace(/\/$/, "");
}

export function mediaObjectUrl(objectKey: string | undefined | null, auth = false): string | undefined {
  if (!objectKey) return undefined;
  const base = mediaBaseUrl();
  if (!base) return undefined;
  const url = `${base}/o/${encodeURIComponent(objectKey)}`;
  // Auth for members-only is applied via fetch/video headers by callers; URL itself is the same.
  void auth;
  return url;
}

export function dogImageSrc(
  dog: { id?: string; image?: string; image_key?: string },
  pbBaseUrl: string
): string | undefined {
  const keyUrl = mediaObjectUrl(dog.image_key);
  if (keyUrl) return keyUrl;
  if (dog.image && dog.id && pbBaseUrl) {
    return `${pbBaseUrl.replace(/\/$/, "")}/api/files/dogs/${dog.id}/${dog.image}`;
  }
  return undefined;
}

export function avatarSrc(
  user: { id?: string; avatar?: string; avatar_key?: string },
  pbBaseUrl: string
): string | undefined {
  const keyUrl = mediaObjectUrl(user.avatar_key);
  if (keyUrl) return keyUrl;
  if (user.avatar && user.id && pbBaseUrl) {
    return `${pbBaseUrl.replace(/\/$/, "")}/api/files/users/${user.id}/${user.avatar}`;
  }
  return undefined;
}

type UploadSession = {
  objectKey: string;
  uploadUrl: string;
  uploadToken: string;
  url: string;
};

async function createUploadSession(opts: {
  contentType: string;
  kind: MediaKind;
  byteLength: number;
  visibility: MediaVisibility;
}): Promise<UploadSession> {
  const base = mediaBaseUrl();
  if (!base) throw new Error("VITE_MEDIA_URL saknas — konfigurera media-host.");
  const token = pb.authStore.token;
  if (!token) throw new Error("Du måste vara inloggad för att ladda upp.");

  const res = await fetch(`${base}/v1/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contentType: opts.contentType,
      kind: opts.kind,
      byteLength: opts.byteLength,
      visibility: opts.visibility,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Upload init failed (${res.status})`);
  }
  return (await res.json()) as UploadSession;
}

async function putUpload(session: UploadSession, file: Blob, contentType: string): Promise<void> {
  const res = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "X-Upload-Token": session.uploadToken,
    },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Upload failed (${res.status})`);
  }
}

/** Upload a file to R2 via the media Worker; returns object key + public URL path. */
export async function uploadToR2(
  file: Blob,
  opts: {
    kind: MediaKind;
    visibility?: MediaVisibility;
    contentType?: string;
  }
): Promise<{ objectKey: string; url: string }> {
  const base = mediaBaseUrl();
  if (!base) {
    throw new Error(
      "Media-host saknas. Sätt VITE_MEDIA_URL (t.ex. https://media.hundkrets.se) och deploya workers/media."
    );
  }
  const contentType = opts.contentType || file.type || (opts.kind === "video" ? "video/mp4" : "image/jpeg");
  const visibility = opts.visibility ?? "public";
  const max = opts.kind === "video" ? MAX_VIDEO_SIZE_BYTES : MAX_MEDIA_IMAGE_BYTES;
  if (file.size > max) {
    throw new Error(opts.kind === "video" ? "Videon är för stor (max 25 MB)." : "Bilden är för stor (max 5 MB).");
  }
  const session = await createUploadSession({
    contentType,
    kind: opts.kind,
    byteLength: file.size,
    visibility,
  });
  await putUpload(session, file, contentType);
  return { objectKey: session.objectKey, url: session.url };
}

/** Create a media metadata row for an already-uploaded R2 object. */
export async function saveMediaRecord(opts: {
  objectKey: string;
  kind: MediaKind;
  visibility?: MediaVisibility;
  posterKey?: string;
  durationMs?: number;
  width?: number;
  height?: number;
}): Promise<MediaRecord> {
  const userId = pb.authStore.model?.id;
  if (!userId) throw new Error("Not authenticated");
  const record = await pb.collection("media").create({
    owner: userId,
    kind: opts.kind,
    object_key: opts.objectKey,
    poster_key: opts.posterKey,
    visibility: opts.visibility ?? "public",
    duration_ms: opts.durationMs,
    width: opts.width,
    height: opts.height,
  });
  return record as unknown as MediaRecord;
}

/** Upload image/video and create a PocketBase media record. */
export async function createMediaRecord(opts: {
  file: Blob;
  kind: MediaKind;
  visibility?: MediaVisibility;
  posterFile?: Blob | null;
  durationMs?: number;
  width?: number;
  height?: number;
  contentType?: string;
}): Promise<MediaRecord> {
  const visibility = opts.visibility ?? "public";

  const uploaded = await uploadToR2(opts.file, {
    kind: opts.kind,
    visibility,
    contentType: opts.contentType,
  });

  let posterKey: string | undefined;
  if (opts.posterFile && opts.kind === "video") {
    const poster = await uploadToR2(opts.posterFile, {
      kind: "image",
      visibility,
      contentType: opts.posterFile.type || "image/jpeg",
    });
    posterKey = poster.objectKey;
  }

  return saveMediaRecord({
    objectKey: uploaded.objectKey,
    kind: opts.kind,
    visibility,
    posterKey,
    durationMs: opts.durationMs,
    width: opts.width,
    height: opts.height,
  });
}

export async function reportMedia(mediaId: string, reason = ""): Promise<void> {
  const userId = pb.authStore.model?.id;
  if (!userId) throw new Error("Not authenticated");
  await pb.collection("media_reports").create({
    media: mediaId,
    reporter: userId,
    reason: reason.slice(0, 500),
  });
}

export async function fetchOwnerMedia(ownerId: string, opts?: { limit?: number }): Promise<MediaRecord[]> {
  const limit = opts?.limit ?? 50;
  const list = await pb.collection("media").getList(1, limit, {
    filter: `owner = "${ownerId}"`,
    sort: "-created",
  });
  return list.items as unknown as MediaRecord[];
}

/** Latest media per owner id (one query + group in JS). */
export async function fetchLatestMediaByOwners(ownerIds: string[]): Promise<Map<string, MediaRecord>> {
  const map = new Map<string, MediaRecord>();
  const unique = [...new Set(ownerIds.filter(Boolean))];
  if (!unique.length) return map;

  // PocketBase filter length limits — batch
  const chunkSize = 20;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const filter = chunk.map((id) => `owner = "${id}"`).join(" || ");
    const list = await pb.collection("media").getList(1, chunk.length * 5, {
      filter,
      sort: "-created",
    });
    for (const item of list.items as unknown as MediaRecord[]) {
      if (!map.has(item.owner)) map.set(item.owner, item);
    }
  }
  return map;
}

/** Grab a JPEG poster from a video File at ~0.1s. */
export async function extractVideoPoster(file: File): Promise<{ poster: Blob; durationMs: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Kunde inte läsa video."));
    });
    const durationMs = Math.round((video.duration || 0) * 1000);
    if (durationMs > MAX_VIDEO_DURATION_MS + 500) {
      throw new Error("Videon får vara max 15 sekunder.");
    }
    video.currentTime = Math.min(0.1, (video.duration || 1) * 0.05);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas saknas");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Poster misslyckades"))), "image/jpeg", 0.85);
    });
    return { poster, durationMs, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
