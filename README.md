# Hundkrets

En lättviktig peer-to-peer hundpassningsplattform. Hundägare matchas utifrån kompletterande resedatum, plats och hundkompatibilitet – ingen betalning, ömsesidigt utbyte.

## Tech Stack

- **Backend:** PocketBase (SQLite, REST API, auth)
- **Frontend:** SolidJS + SolidStart (TypeScript)

Se [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) för arkitekturval och motiveringar.

## Snabbstart

### 1. PocketBase

PocketBase-binären ingår. Starta (migrations körs automatiskt):

```bash
./pocketbase serve
```

Admin: http://127.0.0.1:8090/_/  
API: http://127.0.0.1:8090/api/

Skapa admin-konto vid första körning. Schemat (users, dogs, watch_needs, watch_capacity, conversations, messages) skapas via migrations i `pb_migrations/`. Nya användare måste slutföra onboarding (profil → hundar → behov → kapacitet) innan matchningar visas.

**E-post:** När SMTP och Meta sender address är konfigurerade (Settings → Mail + Meta) skickas mail vid förfrågningar, mutual match och välkomst. För lokal test: `docker compose --profile dev up` lägger till Mailpit (http://localhost:8025). Se [docs/EMAIL-DEBUG.md](docs/EMAIL-DEBUG.md).

**Landningskarta:** Startsidan visar användares ungefärliga platser. PocketBase exponerar `/api/hundkrets/user-locations` (id, lat, lon, area) – ingen auth krävs.

### 2. Frontend

```bash
cd app
npm install
npm run dev
```

**Git hooks:** `npm install` i `app/` installerar pre-commit-hook som kör tester. Manuellt: `./scripts/install-git-hooks.sh`

**Favicon:** Om `public/favicon.png` har ljus bakgrund:

```bash
cd app && npm run favicon:transparent
```

Öppna http://localhost:3000

### 3. Kör båda

Terminal 1: `./pocketbase serve`  
Terminal 2: `cd app && npm run dev`

### 4. Seed-data (valfritt)

Återställ och seeda 10 Malmö-användare med hundar, behov och kapacitet:

```bash
./scripts/reset-and-seed.sh
```

Eller manuellt: stoppa PocketBase, `rm -rf pb_data`, starta `./pocketbase serve`, skapa admin, sedan `cd app && npm run seed`.

Alla seed-användare: **password123!**  
E-post: anna.malmo@example.com, erik.malmo@example.com, etc.

Sätt din profil till **Malmö** för att se matchningar.

## Deployment (Docker Compose)

För NixOS eller annan server med Docker:

```bash
# 1. Sätt PocketBase-URL (hur webbläsaren når den)
export VITE_POCKETBASE_URL=http://YOUR_SERVER_IP:8090   # eller https://your-domain.com

# 2. Bygg och kör
docker compose up -d

# 3. Öppna appen
# App:    http://YOUR_SERVER_IP:3123
# Admin:  http://YOUR_SERVER_IP:8099/_/
```

Skapa admin vid första körning på `http://YOUR_SERVER_IP:8099/_/`. Data sparas i `pb_data`-volymen.

**ARM64 (Raspberry Pi):** Ändra `linux_amd64` till `linux_arm64` i `docker/pocketbase/Dockerfile`.

Se [docs/HOSTING-GUIDE.md](docs/HOSTING-GUIDE.md) för Cloudflare Tunnel och produktion.

## Projektstruktur

```
hundkrets/
├── app/                    # SolidJS-frontend (SolidStart)
│   ├── routes/             # Filbaserad routing
│   │   ├── index.tsx       # Landningssida
│   │   ├── app/            # Inloggade routes (explore, profile, chats, …)
│   │   ├── onboarding/     # Onboarding-flöde
│   │   └── api/            # API-routes
│   ├── src/
│   │   ├── lib/            # Affärslogik (matching, geocode, pocketbase, …)
│   │   └── components/     # Återanvändbara komponenter
│   └── lib → src/lib       # Symlänk (krävs för build)
├── pb_hooks/               # PocketBase-hooks (e-post, cleanup)
├── pb_migrations/          # Databasschema
├── docker/                 # Dockerfiles
├── scripts/                # Deploy, seed, mailpit-certs
└── docs/                   # Dokumentation
```

## Dokumentation

Se [docs/README.md](docs/README.md) för fullständig översikt.

| Dokument | Beskrivning |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arkitektur, val och dataflöde |
| [docs/HOSTING-GUIDE.md](docs/HOSTING-GUIDE.md) | Cloudflare Tunnel, produktion |
| [docs/EMAIL-DEBUG.md](docs/EMAIL-DEBUG.md) | Mailpit, e-postflöden, felsökning |
| [docs/ASSET_GENERATION_PROMPTS.md](docs/ASSET_GENERATION_PROMPTS.md) | Prompts för bildgenerering |
| [TODO.md](TODO.md) | Prioriterad funktionslista |

### Retention Emails (Veckouppdatering)

Automatisk e-post till inaktiva användare som inte loggat in på 7-14 dagar:

- **Trigger:** Cron-jobb körs varje måndag kl 9:00 (`cronAdd` i `pb_hooks/main.pb.js`)
- **Målgrupp:** Användare som inte loggat in på 1-2 veckor, inte skickat intresseanmälningar
- **Innehåll:** Antal nya användare inom valt avstånd (1/3/5/10/20 km), namn på nya användare
- **Inställningar:** Användare kan toggle:a av/på och ändra radie i profilinställningar
- **Avregistrering:** Länk i e-post + inställningssida

**Databasfält:**
- `retention_email_enabled` (bool, default true)
- `retention_radius` (number, default 3 km)
- `last_retention_email_sent` (date)

**Testa:** `curl -X POST http://127.0.0.1:8090/api/test/retention-emails`

## Skript

| Kommando | Beskrivning |
|----------|-------------|
| `./scripts/reset-and-seed.sh` | Återställ DB och seeda Malmö-data |
| `./scripts/mailpit-certs.sh` | Skapa cert för Mailpit (lokal e-posttest) |
| `./scripts/install-git-hooks.sh` | Installera pre-commit (kör tester) |
| `cd app && npm run test:email` | Testa e-postflöden (PocketBase + Mailpit) |
| `cd app && npm run seed` | Seeda användare (kräver tom/ny DB) |
