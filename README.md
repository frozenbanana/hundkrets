# Dog Watch Match

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

### 2. Frontend

```bash
cd app
npm install
npm run dev
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

## Project Structure

```
dogwatchmatch/
├── pb_migrations/     # PocketBase schema migrations
├── app/               # SolidJS frontend (SolidStart)
├── pocketbase         # PocketBase binary
└── README.md
```
