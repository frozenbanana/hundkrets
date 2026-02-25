# Hundkrets – Home Server Hosting Guide

Step-by-step guide to host Hundkrets on your home server with Cloudflare Tunnel.

---

## Prerequisites

- Home server with Docker and Docker Compose
- Cloudflare account
- Domain (e.g. hundkrets.se) added to Cloudflare

---

## Step 1: Configure Cloudflare Tunnel

You need **two** public hostnames: one for the app, one for PocketBase.

### 1.1 Open Cloudflare Zero Trust

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks** → **Tunnels**
3. Select your tunnel (or create one if needed)

### 1.2 Add public hostnames

Add or verify these routes:

| Public hostname      | Service        | URL                    |
|----------------------|----------------|------------------------|
| `hundkrets.se`       | HTTP           | `http://localhost:3123` |
| `api.hundkrets.se`   | HTTP           | `http://localhost:8099` |

**How to add a hostname:**

1. Click **Configure** on your tunnel
2. Go to the **Public Hostname** tab
3. Click **Add a public hostname**
4. **Subdomain:** `api` (or leave empty for root domain)
5. **Domain:** `hundkrets.se`
6. **Service type:** HTTP
7. **URL:** `localhost:8099` (for PocketBase) or `localhost:3123` (for app)
8. Save

Repeat so you have both hostnames configured.

---

## Step 2: Prepare the project on your server

### 2.1 Clone or copy the repo

```bash
# If deploying from your dev machine, copy to server:
scp -r /home/henry/Code/personal/dogwatchmatch henry@YOUR_SERVER_IP:/home/henry/Services/hundkrets
```

Or clone from git if the repo is remote.

### 2.2 Create `.env` on the server

On the server, create `app/.env` (and optionally `.env` in project root for build-time vars like `VITE_POCKETBASE_URL`):

```bash
# URL the browser uses to reach PocketBase (must match your Cloudflare hostname)
VITE_POCKETBASE_URL=https://api.hundkrets.se

```


---

## Step 3: Build and run with Docker Compose

### 3.1 Build with the correct PocketBase URL

`VITE_POCKETBASE_URL` is baked in at build time. Set it before building:

```bash
cd /home/henry/Services/hundkrets

export VITE_POCKETBASE_URL=https://api.hundkrets.se
docker compose build --no-cache app
```

### 3.2 Start the stack

```bash
docker compose up -d
```

### 3.3 Verify containers

```bash
docker compose ps
```

You should see `pocketbase` and `app` running.

---

## Step 4: Create PocketBase admin account

1. Open **https://api.hundkrets.se/_/**
2. Create an admin account (email + password)

### 4.1 Update `.env` and restart

After creating the admin, update `.env` with those credentials, then:

```bash
docker compose up -d
```

---

## Step 5: Configure PocketBase settings

### 5.1 App URL (for email links)

1. In PocketBase Admin: **Settings** → **Meta**
2. Set **App URL** to: `https://hundkrets.se`
3. Save

### 5.2 Email (required for signup and notifications)

To send **verification emails**, **connection request notifications**, and **match confirmations**:

1. **Settings** → **Mail settings**
   - Configure SMTP (e.g. Gmail, SendGrid, Resend)
   - Under **Verification** template, set **Action URL** to: `https://hundkrets.se/verify-email?token={TOKEN}` (use your App URL)
   - Under **Change email** template, set **Action URL** to: `https://hundkrets.se/verify-email-change?token={TOKEN}` (use your App URL)
   - Under **Password reset** template, set **Action URL** to: `https://hundkrets.se/reset-password?token={TOKEN}` (use your App URL)
2. **Settings** → **Meta**
   - Set **Sender address** (e.g. `noreply@hundkrets.se`) – required for connection/match emails
   - Set **Sender name** (e.g. `Hundkrets`) – optional, defaults to "Hundkrets"
3. Save

### 5.3 Google OAuth (optional)

To allow sign-in with Google:

1. Create an OAuth 2.0 client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add **Authorized redirect URI**: `https://api.hundkrets.se/api/oauth2-redirect` (use your PocketBase URL)
3. Copy **Client ID** and **Client Secret**
4. In PocketBase Admin: **Collections** → **users** → Edit (cog) → **Options** → **OAuth2**
5. Enable Google and paste Client ID and Client Secret
6. Save

---

## Step 6: Verify the app

1. Open **https://hundkrets.se**
2. Sign up or log in
3. Complete onboarding (profile → dogs → needs → capacity)
4. Check that matches and the map work

---

## Updating the app

When you pull new code or make changes:

```bash
cd /home/henry/Services/hundkrets

export VITE_POCKETBASE_URL=https://api.hundkrets.se
docker compose build --no-cache app
docker compose up -d
```

Data in `pb_data` persists across restarts.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Emails not sent (connection/match) | Set **Sender address** in Settings → Meta. SMTP must be configured in Mail settings. |
| App loads but login fails | `VITE_POCKETBASE_URL` must be `https://api.hundkrets.se` and match the Cloudflare hostname for PocketBase |
| Map shows no users | Landningskartan hämtar från publik PocketBase-route `/api/hundkrets/user-locations`. Kontrollera att användare har latitude/longitude ifyllda (profil-steget i onboarding). |
| Email links go to wrong URL | Set **App URL** in PocketBase Admin → Settings → Meta to `https://hundkrets.se`. For verification emails, set **Verification** template **Action URL** to `https://hundkrets.se/verify-email?token={TOKEN}`. For email change, set **Change email** template **Action URL** to `https://hundkrets.se/verify-email-change?token={TOKEN}`. For password reset, set **Password reset** template **Action URL** to `https://hundkrets.se/reset-password?token={TOKEN}` |
| CORS errors | Ensure both hostnames use the same parent domain (`hundkrets.se` and `api.hundkrets.se`) |
| Google OAuth fails | Redirect URI in Google Console must be `{VITE_POCKETBASE_URL}/api/oauth2-redirect` exactly |

---

## Summary

| URL | Purpose |
|-----|---------|
| https://hundkrets.se | App (SolidJS frontend) |
| https://api.hundkrets.se | PocketBase API + Admin UI |
| https://api.hundkrets.se/_/ | PocketBase Admin |
