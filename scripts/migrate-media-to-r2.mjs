#!/usr/bin/env node
/**
 * Migrate PocketBase dog images + user avatars to Cloudflare R2 via media Worker.
 *
 * Required env:
 *   PB_URL                 e.g. https://api.hundkrets.se
 *   PB_ADMIN_EMAIL
 *   PB_ADMIN_PASSWORD
 *   MEDIA_URL              e.g. https://media.hundkrets.se
 *   MIGRATE_SECRET         must match Worker secret
 *
 * Usage:
 *   node scripts/migrate-media-to-r2.mjs
 *   DRY_RUN=1 node scripts/migrate-media-to-r2.mjs
 */

const PB_URL = (process.env.PB_URL || process.env.VITE_POCKETBASE_URL || "").replace(/\/$/, "");
const MEDIA_URL = (process.env.MEDIA_URL || process.env.VITE_MEDIA_URL || "").replace(/\/$/, "");
const MEDIA_PREFIX = (process.env.MEDIA_PREFIX || "production").replace(/^\/+|\/+$/g, "") || "production";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || "";
const MIGRATE_SECRET = process.env.MIGRATE_SECRET || "";
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!PB_URL) fail("PB_URL required");
if (!MEDIA_URL) fail("MEDIA_URL required");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) fail("PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD required");
if (!MIGRATE_SECRET && !DRY_RUN) fail("MIGRATE_SECRET required (or DRY_RUN=1)");

async function adminAuth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (res.ok) {
    const data = await res.json();
    return data.token;
  }
  const body = await res.text().catch(() => "");
  // PocketBase older versions used /api/admins/auth-with-password
  const res2 = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (res2.ok) {
    const data = await res2.json();
    return data.token;
  }
  fail(
    `Admin auth failed for ${ADMIN_EMAIL} against ${PB_URL}\n` +
      `  _superusers → ${res.status}: ${body.slice(0, 200)}\n` +
      `  admins → ${res2.status}\n` +
      `Check PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD (keep the command on one line; quote the password).`
  );
}

async function listAll(token, collection, filter = "") {
  const items = [];
  let page = 1;
  for (;;) {
    const qs = new URLSearchParams({
      page: String(page),
      perPage: "100",
      filter,
    });
    const res = await fetch(`${PB_URL}/api/collections/${collection}/records?${qs}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) fail(`List ${collection} failed: ${res.status}`);
    const data = await res.json();
    items.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) break;
    page += 1;
  }
  return items;
}

async function downloadPbFile(collection, recordId, filename, token) {
  const url = `${PB_URL}/api/files/${collection}/${recordId}/${encodeURIComponent(filename)}`;
  const res = await fetch(url, { headers: { Authorization: token } });
  if (!res.ok) throw new Error(`download ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  return { buf, contentType };
}

async function putMigrate(objectKey, buf, contentType, ownerId, kind) {
  if (DRY_RUN) {
    console.log(`[dry-run] PUT ${objectKey} (${buf.length} bytes, ${contentType})`);
    return;
  }
  const res = await fetch(`${MEDIA_URL}/v1/migrate/${encodeURIComponent(objectKey)}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "X-Migrate-Secret": MIGRATE_SECRET,
      "X-Owner-Id": ownerId,
      "X-Kind": kind,
      "X-Visibility": "public",
    },
    body: buf,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`migrate put ${objectKey}: ${res.status} ${text}`);
  }
}

async function patchRecord(token, collection, id, body) {
  if (DRY_RUN) {
    console.log(`[dry-run] PATCH ${collection}/${id}`, body);
    return;
  }
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`patch ${collection}/${id}: ${res.status} ${text}`);
  }
}

async function collectionExists(token, name) {
  const res = await fetch(`${PB_URL}/api/collections/${encodeURIComponent(name)}`, {
    headers: { Authorization: token },
  });
  return res.ok;
}

async function createMedia(token, body) {
  if (DRY_RUN) {
    console.log(`[dry-run] CREATE media`, body);
    return true;
  }
  const res = await fetch(`${PB_URL}/api/collections/media/records`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`create media warn: ${res.status} ${text}`);
    return false;
  }
  return true;
}

function extFromName(name, contentType) {
  const m = String(name).match(/\.([a-z0-9]+)$/i);
  if (m) return m[1].toLowerCase();
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function main() {
  console.log(`Migrating to ${MEDIA_URL} (prefix=${MEDIA_PREFIX}) from ${PB_URL}${DRY_RUN ? " (dry run)" : ""}`);
  const token = await adminAuth();

  const hasMediaCol = await collectionExists(token, "media");
  if (!hasMediaCol) {
    console.warn(
      "\nWARNING: PocketBase collection `media` does not exist yet.\n" +
        "  Files will still upload to R2 and dogs.image_key / users.avatar_key will be set,\n" +
        "  but profile grids need the `media` collection.\n" +
        "  Deploy/restart PocketBase so pb_migrations/1775000000_media_r2.js applies,\n" +
        "  then re-run with SEED_MEDIA_ONLY=1.\n"
    );
  }

  const seedOnly = process.env.SEED_MEDIA_ONLY === "1" || process.env.SEED_MEDIA_ONLY === "true";
  let dogOk = 0;
  let mediaSeeded = 0;

  const dogs = await listAll(token, "dogs");
  for (const dog of dogs) {
    try {
      if (seedOnly) {
        if (!dog.image_key || !hasMediaCol) continue;
        const ok = await createMedia(token, {
          owner: dog.owner,
          kind: "image",
          object_key: dog.image_key,
          visibility: "public",
        });
        if (ok) {
          mediaSeeded += 1;
          console.log(`seeded media for dog ${dog.id}`);
        }
        continue;
      }

      if (dog.image_key) {
        // Already migrated to R2; optionally backfill media row
        if (hasMediaCol) {
          const ok = await createMedia(token, {
            owner: dog.owner,
            kind: "image",
            object_key: dog.image_key,
            visibility: "public",
          });
          if (ok) mediaSeeded += 1;
        }
        continue;
      }

      const filename = Array.isArray(dog.image) ? dog.image[0] : dog.image;
      if (!filename) continue;

      const { buf, contentType } = await downloadPbFile("dogs", dog.id, filename, token);
      const ext = extFromName(filename, contentType);
      const objectKey = `${MEDIA_PREFIX}/users/${dog.owner}/migrated-dog-${dog.id}.${ext}`;
      await putMigrate(objectKey, buf, contentType, dog.owner, "image");
      await patchRecord(token, "dogs", dog.id, { image_key: objectKey });
      if (hasMediaCol) {
        const ok = await createMedia(token, {
          owner: dog.owner,
          kind: "image",
          object_key: objectKey,
          visibility: "public",
        });
        if (ok) mediaSeeded += 1;
      }
      dogOk += 1;
      console.log(`dog ${dog.id} -> ${objectKey}`);
    } catch (err) {
      console.error(`dog ${dog.id} failed:`, err.message || err);
    }
  }

  let avatarOk = 0;
  if (!seedOnly) {
    const users = await listAll(token, "users");
    for (const user of users) {
      if (user.avatar_key) continue;
      const filename = Array.isArray(user.avatar) ? user.avatar[0] : user.avatar;
      if (!filename) continue;
      try {
        const { buf, contentType } = await downloadPbFile("users", user.id, filename, token);
        const ext = extFromName(filename, contentType);
        const objectKey = `${MEDIA_PREFIX}/users/${user.id}/migrated-avatar.${ext}`;
        await putMigrate(objectKey, buf, contentType, user.id, "image");
        await patchRecord(token, "users", user.id, { avatar_key: objectKey });
        avatarOk += 1;
        console.log(`user ${user.id} avatar -> ${objectKey}`);
      } catch (err) {
        console.error(`user ${user.id} avatar failed:`, err.message || err);
      }
    }
  }

  console.log(
    `Done. Dogs uploaded: ${dogOk}. Avatars uploaded: ${avatarOk}. Media rows seeded: ${mediaSeeded}.`
  );
  if (!hasMediaCol) {
    console.log("Next: apply PocketBase migrations, then: SEED_MEDIA_ONLY=1 ... node scripts/migrate-media-to-r2.mjs");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
