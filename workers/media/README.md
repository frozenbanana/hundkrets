# Hundkrets media Worker

Serves and accepts uploads for `media.hundkrets.se` (Cloudflare R2).

Objects are stored under bucket prefixes matching your folders:

- `production/users/{userId}/...` (default deploy)
- `development/users/{userId}/...` (`--env development`)

## Important: domain ownership

`media.hundkrets.se` must be a **Worker custom domain** (or route), not a public R2 bucket domain.
The Worker checks PocketBase auth for `members`-only files. A public R2 custom domain bypasses that.

If you already attached `media.hundkrets.se` as an R2 public access domain, remove it from R2 and attach it to the Worker instead (Workers → hundkrets-media → Settings → Domains & Routes → Custom Domains).

## Setup checklist

1. Bucket `hundkrets-media` exists (you did this) with folders `production/` and `development/`.
2. From this directory:
   ```bash
   cd workers/media
   npm install
   npx wrangler login          # once, if needed
   npx wrangler secret put UPLOAD_SIGNING_SECRET
   npx wrangler secret put MIGRATE_SECRET
   npx wrangler deploy
   ```
3. Attach custom domain **`media.hundkrets.se`** to the Worker `hundkrets-media`.
4. Smoke test:
   ```bash
   curl https://media.hundkrets.se/health
   # expect: {"ok":true}
   ```
5. App env (`app/.env`) and rebuild:
   ```bash
   VITE_MEDIA_URL=https://media.hundkrets.se
   ```
6. Restart PocketBase so migration `1775000000_media_r2.js` applies (`media`, `media_reports`, `image_key`, `avatar_key`).
7. Optional — migrate existing PB dog photos / avatars:
   ```bash
   PB_URL=https://api.hundkrets.se \
   MEDIA_URL=https://media.hundkrets.se \
   PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... \
   MIGRATE_SECRET=... \
   node scripts/migrate-media-to-r2.mjs
   ```
   Dry run first: `DRY_RUN=1 ...`

## Development Worker (optional)

```bash
npx wrangler secret put UPLOAD_SIGNING_SECRET --env development
npx wrangler secret put MIGRATE_SECRET --env development
npx wrangler deploy --env development
```

Point a local/staging app at that Worker’s URL (or a `media-dev.hundkrets.se` custom domain) with `VITE_MEDIA_URL`.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/uploads` | Bearer PB token | Mint upload URL + token |
| PUT | `/v1/objects/:key` | `X-Upload-Token` | Upload bytes |
| GET | `/o/:key` | Bearer if `members` | Deliver media |
| PUT | `/v1/migrate/:key` | `X-Migrate-Secret` | Migration uploads |
| GET | `/health` | — | Liveness |
