# Hundkrets

A lightweight peer-to-peer dog-sitting exchange platform. Dog owners match based on complementary travel dates, location, and dog compatibility—no money, mutual help.

## Tech Stack

- **Backend**: PocketBase (SQLite, REST API, auth)
- **Frontend**: SolidJS + SolidStart (TypeScript)

## Setup

### 1. PocketBase

The PocketBase binary is included. Start it (migrations run automatically):

```bash
./pocketbase serve
```

Admin UI: http://127.0.0.1:8090/_/  
API: http://127.0.0.1:8090/api/

Create an admin account on first run. The schema (users, dogs, watch_needs, watch_capacity) is created via migrations in `pb_migrations/`. New users must complete onboarding (profile → dogs → needs → capacity) before seeing matches; the `onboarding_complete` field tracks this.

**Landing page map:** The homepage shows a map of users' approximate locations. PocketBase exposes a public route `/api/hundkrets/user-locations` (id, latitude, longitude, area only) – no auth needed.

### 2. Frontend

```bash
cd app
npm install
npm run dev
```

**Favicon:** If `public/favicon.png` has a light background, make it transparent:

```bash
cd app && npm run favicon:transparent
```

Open http://localhost:3000

### 3. Run both

In one terminal: `./pocketbase serve`  
In another: `cd app && npm run dev`

### 4. Seed data (optional)

Reset and seed 10 Malmö users with dogs, needs, and capacities:

```bash
./scripts/reset-and-seed.sh
```

Or manually: stop PocketBase, `rm -rf pb_data`, start `./pocketbase serve`, create admin, then `cd app && npm run seed`.

All seed users: **password123!**  
Emails: anna.malmo@example.com, erik.malmo@example.com, etc.

Set your profile to **Malmö** to see matches.

## Deployment (Docker Compose)

For NixOS or any server with Docker:

```bash
# 1. Set the PocketBase URL (how the browser reaches it)
export VITE_POCKETBASE_URL=http://YOUR_SERVER_IP:8090   # or https://your-domain.com

# 2. Build and run
docker compose up -d

# 3. Open the app
# App:    http://YOUR_SERVER_IP:3000
# Admin:  http://YOUR_SERVER_IP:8090/_/
```

Create an admin account on first run at `http://YOUR_SERVER_IP:8090/_/`. Data persists in the `pb_data` volume.

**ARM64 (Raspberry Pi):** Edit `docker/pocketbase/Dockerfile` and change `linux_amd64` to `linux_arm64` in the download URL.

## Project Structure

```
dogwatchmatch/
├── docker/            # Dockerfiles
├── pb_migrations/     # PocketBase schema migrations
├── app/               # SolidJS frontend (SolidStart)
├── pocketbase         # PocketBase binary (dev only)
└── README.md
```
