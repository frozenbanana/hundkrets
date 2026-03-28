# Hundkrets – Arkitektur och val

Detta dokument beskriver hur Hundkrets är uppbyggt och varför vi gjort vissa val.

---

## Översikt

Hundkrets är en peer-to-peer hundpassningsplattform. Användare matchas baserat på kompletterande behov och kapacitet (du behöver passning när de kan erbjuda, och vice versa), plats och hundkompatibilitet. Ingen betalning – ömsesidigt utbyte.

---

## Tech Stack

| Lager | Teknik | Version | Motivering |
|-------|--------|---------|------------|
| **Backend** | PocketBase + SQLite | v0.36.x | Lättviktig, inbyggd REST API, auth, realtid. Inga separata servrar. |
| **Frontend** | SolidJS + SolidStart | SolidJS v1.9.x, SolidStart v1.2.x | Reaktivt, snabbt, TypeScript. SolidStart ger routing och build. |
| **Frontend SDK** | pocketbase-js | v0.21.x | Officiell JavaScript SDK för PocketBase |
| **Kartor** | Leaflet | v1.9.x | Enkel, ingen API-nyckel. |
| **Deploy** | Docker Compose | - | Enkel uppsättning för hemmaserver eller VPS. |

---

## Arkitekturval

### SPA (Single Page Application)

`ssr: false` i `app.config.ts` – appen körs som SPA. Sidor renderas i webbläsaren.

- **Fördelar:** Enklare hosting, mindre serverbelastning, snabb interaktivitet.
- **Nackdelar:** Sämre SEO för dynamiskt innehåll. Landningssidan har statisk meta – tillräckligt för delning.

### PocketBase som backend

- **Schema:** Migrations i `pb_migrations/` – versionerat, reproducerbart.
- **Hooks:** `pb_hooks/main.pb.js` – e-post, städning vid user delete, chat-guards.
- **Ingen separat API-server** – PocketBase exponerar REST och realtid direkt.
- **Realtime:** WebSocket-baserad prenumeration på samlingar.

#### JSVM-scope (goja) – viktigt för hooks

PocketBase kör JavaScript-hooks i en inbäddad ES5-motor (goja). **Varje handler-callback körs i sin egen isolerade scope** – variabler och funktioner deklarerade utanför en handler är *inte* tillgängliga inuti den.

Dela kod mellan handlers via `require()` med en lokal modul:

```javascript
// pb_hooks/hk_utils.js  (utan .pb.js – laddas inte automatiskt)
module.exports = {
  toId: function(v) { /* ... */ },
};

// pb_hooks/main.pb.js
onRecordCreateRequest((e) => {
  var hk = require(__hooks + "/hk_utils.js");   // cachad efter första anrop
  var id = hk.toId(e.record.get("relation"));
  // ...
  e.next();
}, "my_collection");
```

Se: https://pocketbase.io/docs/js-overview

### Path alias `~/`

Importer använder `~/lib/...` och `~/components/...`. Aliaset mappar till `app/src/`.

- **Symlänk `app/lib` → `app/src/lib`:** Nitro-prerender (build) löser `lib/` till `app/lib/`. Symlänken gör att både Vite och Nitro hittar samma kod utan duplicering.

---

## Projektstruktur

```
hundkrets/
├── app/                       # SolidJS-frontend (SolidStart)
│   ├── routes/                # Filbaserad routing
│   │   ├── index.tsx          # Landningssida (publik)
│   │   ├── login.tsx          # Inloggning
│   │   ├── register/          # Registrering + e-postverifiering
│   │   ├── onboarding/        # Onboarding-flöde (4 steg)
│   │   ├── app/               # Inloggade routes
│   │   │   ├── index.tsx      # Omdirigera till /app/explore
│   │   │   ├── explore.tsx    # Huvudvy – hitta matchningar
│   │   │   ├── explore/       # Explore-moduler (MatchCard, modals)
│   │   │   ├── profile/       # Profilvisning och redigering
│   │   │   ├── dogs/          # Hundhantering
│   │   │   ├── needs/         # Passningsbehov
│   │   │   ├── capacity/      # Passningskapacitet
│   │   │   ├── chats/         # Konversationer
│   │   │   ├── matches.tsx    # Ömsesidiga matchningar
│   │   │   └── settings.tsx   # Kontoinställningar
│   │   └── api/               # API-routes (server-side)
│   ├── src/
│   │   ├── lib/               # Affärslogik
│   │   │   ├── pocketbase.ts  # PocketBase-klient (singleton)
│   │   │   ├── auth.ts        # Auth-hjälpfunktioner
│   │   │   ├── authStore.ts   # Auth-state + refresh
│   │   │   ├── matching.ts    # Matchningsalgoritm (Haversine)
│   │   │   ├── geocode.ts     # Geokodning (postnummer → koordinater)
│   │   │   ├── chat.ts        # Chatt-hjälpfunktioner
│   │   │   ├── chat-realtime.ts # Realtime-prenumerationer
│   │   │   ├── oauth.ts       # OAuth2-hantering
│   │   │   └── ...
│   │   ├── components/        # Återanvändbara komponenter
│   │   └── types.ts           # TypeScript-typer
│   ├── lib → src/lib          # Symlänk för Nitro build
│   ├── public/                # Statiska filer
│   ├── app.tsx                # Root-komponent
│   ├── app.css                # Globala stilar
│   └── app.config.ts          # SolidStart-konfiguration
├── pb_hooks/                  # PocketBase server-hooks
│   └── main.pb.js             # Alla hooks (e-post, cleanup, chat-guard)
├── pb_migrations/             # Databasschema-migrationer
├── pb_data/                   # PocketBase-data (ignoreras av git)
├── docker/                    # Dockerfiles
├── scripts/                   # Deploy, seed, mailpit-certs, git hooks
└── docs/                      # Dokumentation
```

### Utforska-sidan (`routes/app/explore`)

Huvudvyn för att hitta matchningar. Uppdelad för underhållbarhet:

| Fil | Ansvar |
|-----|--------|
| `explore.tsx` | Route, datahämtning, state, handlers (~1000 rader) |
| `explore/helpers.ts` | formatDate, dateStr, labels, filter-logik |
| `explore/types.ts` | Conn, DogRecord |
| `explore/MatchCard.tsx` | Match-kort och lista |
| `explore/MatchDetailModal.tsx` | Detaljvy med behov/kapacitet |
| `explore/InterestModal.tsx` | Modal för intresseförfrågan |
| `explore/RespondModal.tsx` | Modal för svar på förfrågan |
| `explore/ExchangeTypeIcon.tsx` | Ikon för utbytestyp |

---

## Datamodell

### Samlingar (Collections)

| Samling | Typ | Beskrivning |
|---------|-----|-------------|
| `users` | auth | Användarkonton med profildata |
| `dogs` | base | Hundar kopplade till användare |
| `watch_needs` | base | När användare behöver passning |
| `watch_capacity` | base | När användare kan passa |
| `connection_requests` | base | Intresseförfrågningar |
| `conversations` | base | Chatt-konversationer |
| `messages` | base | Chattmeddelanden |
| `postal_codes` | base | Svenska postnummer → områden |
| `email_log` | base | Logg över skickade e-post |
| `_superusers` | auth | Admin-konton (PocketBase) |

### `users`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `name` | text | Visningsnamn |
| `phone` | text | Telefonnummer |
| `email` | email | E-post (auth) |
| `area` | text | Område/ort |
| `city` | text | Stad |
| `neighborhood` | text | Stadsdel |
| `address_private` | text | Full adress (privat) |
| `latitude` | number | Latitud (geokodad) |
| `longitude` | number | Longitud (geokodad) |
| `avatar` | file | Profilbild |
| `user_type` | select | `has_dogs` | `sitter_only` | `receiver_only` |
| `onboarding_complete` | bool | Har slutfört onboarding |
| `verified` | bool | E-post verifierad |
| `last_login_at` | datetime | Senaste inloggning |
| `retention_email_enabled` | bool | Få veckovis uppdateringar |
| `retention_radius` | number | Radie för uppdateringar (km) |
| `chat_email_frequency` | select | `instant` | `daily` | `off` |

### `dogs`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `owner` | relation → users | Ägare |
| `name` | text | Hundens namn |
| `breed` | text | Ras |
| `size` | select | `small` | `medium` | `large` |
| `gender` | select | `male` | `female` |
| `temperament` | text | Temperament |
| `image` | file | Bild |

### `watch_needs`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `user` | relation → users | Användare |
| `dog` | relation → dogs | Hund |
| `start_date` | date | Startdatum |
| `end_date` | date | Slutdatum |
| `flexible_dates` | bool | Flexibla datum |
| `open_any_duration` | bool | Öppen för alla varaktigheter |
| `duration_specific` | text | Specifik varaktighet |
| `notes` | text | Anteckningar |

### `watch_capacity`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `user` | relation → users | Användare |
| `start_date` | date | Startdatum |
| `end_date` | date | Slutdatum |
| `flexible_dates` | bool | Flexibla datum |
| `open_any_duration` | bool | Öppen för alla varaktigheter |
| `duration_specific` | text | Specifik varaktighet |
| `dog_sizes` | select[] | `small` | `medium` | `large` |
| `dog_genders` | select | `male` | `female` | `any` |
| `max_dogs` | number | Max antal hundar |
| `notes` | text | Anteckningar |

### `connection_requests`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `from_user` | relation → users | Avsändare |
| `to_user` | relation → users | Mottagare |
| `message` | text | Meddelande |

### `conversations`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `user_a` | relation → users | Deltagare A (lägre ID) |
| `user_b` | relation → users | Deltagare B (högre ID) |
| `pair_key` | text | Unik nyckel: `idA:idB` |
| `last_message_at` | datetime | Senaste meddelandetid |

### `messages`-fält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `conversation` | relation → conversations | Konversation |
| `sender` | relation → users | Avsändare |
| `body` | text | Meddelandetext |
| `message_type` | select | `user` | `system` |

---

## Dataflöde

### 1. Matchning

```
findListings() i src/lib/matching.ts
├── Hämta alla watch_needs, watch_capacity, users, dogs
├── Filtrera bort aktuell användare
├── Beräkna avstånd med Haversine-formel
├── Gruppera behov/kapacitet per användare
└── Sortera efter avstånd
```

### 2. Anslutningar (Connection Requests)

```
Användare A skickar intresse
├── POST /api/collections/connection_requests/records
├── PocketBase hook: skicka e-post till mottagare
└── Om B redan skickat intresse till A:
    ├── Skapa conversation med pair_key
    ├── Lägg till meddelanden
    ├── Skicka "ni har matchat"-mail till båda
    └── Visa telefon/adress för båda

Mutual match = båda har skickat intresse
```

### 3. Chatt

```
Endast mutual matches kan chatta
├── Frontend: pb.collection("messages").subscribe()
├── Backend hook: validera att avsändare är deltagare
├── Backend hook: uppdatera last_message_at
└── Backend hook: skicka e-postnotis (instant/daily/off)
```

### 4. E-post (PocketBase Hooks)

| Händelse | E-post |
|----------|--------|
| Ny connection_request | "X är intresserad av dig" |
| Mutual match | "Ni har matchat!" |
| Nytt chattmeddelande | Instant eller daglig sammanfattning |
| Onboarding klar | Välkomstmail |
| Inaktiv användare | Veckovis uppdatering (retention) |

### 5. Onboarding-flöde

```
1. /onboarding/profile    → Namn, telefon, adress
2. /onboarding/dogs       → Lägg till hundar
3. /onboarding/needs      → När behöver du passning?
4. /onboarding/capacity   → När kan du passa?
                           ↓
                    onboarding_complete = true
                           ↓
                    Redirect till /app/explore
```

---

## PocketBase SDK-användning

### Klientinstans

```typescript
// src/lib/pocketbase.ts
import PocketBase from "pocketbase";
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090");
```

### Auth-mönster

```typescript
// Inloggning
const auth = await pb.collection("users").authWithPassword(email, password);
// auth.record innehåller användardata

// OAuth2
await pb.collection("users").authWithOAuth2({ provider: "google" });

// Auth-state
pb.authStore.isValid      // true om inloggad
pb.authStore.record       // aktuell användare (använd .record, inte .model)
pb.authStore.token        // JWT-token

// Utloggning
pb.authStore.clear();

// Refresh (hämta senaste data)
await pb.collection("users").authRefresh();
```

### Datahämtning

```typescript
// Hämta alla poster
const needs = await pb.collection("watch_needs").getFullList();

// Hämta med filter
const user = await pb.collection("users").getFirstListItem(`id = "${userId}"`);

// Skapa
await pb.collection("connection_requests").create({ from_user, to_user });

// Ta bort
await pb.collection("connection_requests").delete(id);
```

### Realtime

```typescript
// Prenumerera på ändringar
const unsub = await pb.collection("messages").subscribe("*", (event) => {
  // event.action: "create" | "update" | "delete"
  // event.record: den nya/ändrade posten
});

// Avsluta prenumeration
unsub();
```

### Viktigt: `record` vs `model`

Använd `pb.authStore.record` (nyare) istället för `pb.authStore.model` (äldre). Båda fungerar, men `record` är den rekommenderade.

---

## Säkerhet

### API-regler (PocketBase)

- `users`: Auth-samling med listRule/viewRule för autentiserade användare
- `dogs`: Endast ägare kan CRUD
- `watch_needs/capacity`: Skapa för alla inloggade, redigera bara egna
- `connection_requests`: Skapa för alla verifierade, lista alla
- `conversations`: Endast deltagare kan läsa
- `messages`: Endast deltagare kan läsa, endast deltagare kan skriva

### Backend-hooks

| Hook | Syfte |
|------|-------|
| `onRecordDelete("users")` | Ta bort relaterade poster innan user delete |
| `onRecordAfterCreateSuccess("conversations")` | Validera mutual match, sätt pair_key |
| `onRecordAfterCreateSuccess("messages")` | Validera avsändare, skicka notis |
| `onRecordCreateRequest("connection_requests")` | Kräv verifierad e-post |
| `onRecordAuthRequest` | Uppdatera last_login_at |
| `onMailerSend` | Logga e-post till email_log |

### Realtime-skydd

```javascript
// pb_hooks/main.pb.js
onRealtimeConnectRequest((e) => {
  if (e.auth.isValid) {
    e.next();
  } else {
    e.response.setStatus(401);
    e.response.stop();
  }
});
```

---

## Frontend-mönster

### Routing

SolidStart använder filbaserad routing i `app/routes/`:

- `routes/index.tsx` → `/`
- `routes/app/explore.tsx` → `/app/explore`
- `routes/app/chats/[id].tsx` → `/app/chats/:id`

### State-hantering

```typescript
// Auth-state med signal för reaktivitet
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";

// Auth-state uppdateras automatiskt via pb.authStore
const isLoggedIn = () => pb.authStore.isValid;
const currentUser = () => pb.authStore.record;

// För att trigga re-render efter authRefresh
export const [authVersion, setAuthVersion] = createSignal(0);
await pb.collection("users").authRefresh();
setAuthVersion(v => v + 1);
```

### Resurser (createResource)

```typescript
// Asynkron datahämtning med caching
const [data, { refetch }] = createResource(
  () => pb.authStore.record?.id, // dependency
  async (userId) => {
    const needs = await pb.collection("watch_needs").getFullList();
    return { needs };
  }
);

// Använd i template
<Show when={data.loading}>Laddar...</Show>
<Show when={data.error}>Fel: {data.error.message}</Show>
<Show when={data()}>{(d) => <List items={d.needs} />}</Show>
```

---

## Miljövariabler

| Variabel | Beskrivning | Standard |
|----------|-------------|----------|
| `VITE_POCKETBASE_URL` | PocketBase-URL (webbläsare) | `http://localhost:8090` |
| `VITE_SITE_URL` | Publik URL för delning | `https://hundkrets.se` |

---

## Testning

```bash
cd app
npm test              # Kör alla tester
npm run test:run      # Kör en gång (CI)
npm run test:email    # Testa e-postflöden
npm run test:geocode  # Testa geokodning
```

Testfiler ligger bredvid källfilerna: `src/lib/matching.test.ts`, etc.

---

## Vanliga uppgifter

### Lägg till ny samling

1. Skapa migration i `pb_migrations/` med tidsstämpel
2. Starta PocketBase – migration körs automatiskt
3. Lägg till TypeScript-typer i `app/src/types.ts`
4. Skapa route i `app/routes/`

### Lägg till ny route

1. Skapa fil i `app/routes/app/` för inloggade routes
2. Använd `<AppShell>` för konsekvent layout
3. Hämta data med `createResource`
4. Använd `pb.authStore.record` för aktuell användare

### Lägg till e-post-händelse

1. Redigera `pb_hooks/main.pb.js`
2. Lägg till hook för relevant händelse
3. Konfigurera SMTP i PocketBase Admin > Settings > Mail

---

## Dokumentation

| Dokument | Innehåll |
|----------|----------|
| [README.md](../README.md) | Setup, deploy, översikt |
| [HOSTING-GUIDE.md](HOSTING-GUIDE.md) | Cloudflare Tunnel, produktion |
| [EMAIL-DEBUG.md](EMAIL-DEBUG.md) | Mailpit, e-postflöden, felsökning |
| [ASSET_GENERATION_PROMPTS.md](ASSET_GENERATION_PROMPTS.md) | Prompts för bildgenerering |
| [TODO.md](../TODO.md) | Prioriterad funktionslista |