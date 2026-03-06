# Hundkrets – Arkitektur och val

Detta dokument beskriver hur Hundkrets är uppbyggt och varför vi gjort vissa val.

---

## Översikt

Hundkrets är en peer-to-peer hundpassningsplattform. Användare matchas baserat på kompletterande behov och kapacitet (du behöver passning när de kan erbjuda, och vice versa), plats och hundkompatibilitet. Ingen betalning – ömsesidigt utbyte.

---

## Tech Stack

| Lager | Teknik | Motivering |
|-------|--------|------------|
| **Backend** | PocketBase + SQLite | Lättviktig, inbyggd REST API, auth, realtid. Inga separata servrar. |
| **Frontend** | SolidJS + SolidStart | Reaktivt, snabbt, TypeScript. SolidStart ger routing och build. |
| **Kartor** | Leaflet | Enkel, ingen API-nyckel. |
| **Deploy** | Docker Compose | Enkel uppsättning för hemmaserver eller VPS. |

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

### Path alias `~/`

Importer använder `~/lib/...` och `~/components/...`. Aliaset mappar till `app/src/`.

- **Symlänk `app/lib` → `app/src/lib`:** Nitro-prerender (build) löser `lib/` till `app/lib/`. Symlänken gör att både Vite och Nitro hittar samma kod utan duplicering.

---

## Projektstruktur

```
hundkrets/
├── app/                    # SolidJS-frontend (SolidStart)
│   ├── routes/             # Filbaserad routing
│   │   ├── index.tsx       # Landningssida
│   │   ├── app/            # Inloggade routes (/app/explore, /app/profile, …)
│   │   │   └── explore/    # Utforska-sidan – uppdelad i moduler
│   │   ├── onboarding/     # Onboarding-flöde
│   │   └── api/            # API-routes (t.ex. dog-gallery)
│   ├── src/
│   │   ├── lib/            # Affärslogik (matching, geocode, pocketbase, …)
│   │   └── components/     # Återanvändbara komponenter
│   ├── lib → src/lib       # Symlänk för Nitro build
│   └── public/
├── pb_hooks/               # PocketBase server-hooks (e-post, cleanup)
├── pb_migrations/          # Databasschema
├── docker/                 # Dockerfiles
├── scripts/               # Deploy, seed, mailpit-certs, git hooks
└── docs/                   # Dokumentation
```

### Utforska-sidan (`routes/app/explore`)

Sidan är uppdelad för underhållbarhet:

| Fil | Ansvar |
|-----|--------|
| `explore.tsx` | Route, datahämtning, state, handlers |
| `explore/helpers.ts` | formatDate, dateStr, labels, filter-logik |
| `explore/types.ts` | Conn, DogRecord |
| `explore/MatchCard.tsx` | Match-kort och lista |
| `explore/MatchDetailModal.tsx` | Detaljvy med behov/kapacitet |
| `explore/InterestModal.tsx` | Modal för intresseförfrågan |
| `explore/RespondModal.tsx` | Modal för svar på förfrågan |

---

## Dataflöde

1. **Matchning:** `findListings()` i `src/lib/matching.ts` – behov, kapacitet, användare och hundar kombineras. Avstånd via Haversine.
2. **Connection requests:** Användare skickar intresse → `connection_requests`. Båda har skickat = mutual match.
3. **E-post:** PocketBase-hooks i `pb_hooks/main.pb.js` – vid ny förfrågan, mutual match, välkomstmail, chattnotiser.
4. **Chatt:** `conversations` + `messages`. Endast mellan mutual matches. Hook sätter `pair_key` och validerar.

---

## Säkerhet och städning

- **User delete:** Hook i `pb_hooks` tar bort relaterade poster (watch_needs, connection_requests, conversations, messages, watch_capacity, dogs) innan användaren raderas.
- **Chat-guard:** Nya konversationer kräver mutual match. Meddelanden valideras mot konversationsdeltagare.
- **Ingen test-endpoint i produktion** – tidigare `/api/hundkrets/test-create-message` är borttagen. E-posttester använder nu användar-auth.

---

## Dokumentation

| Dokument | Innehåll |
|----------|----------|
| [README.md](../README.md) | Setup, deploy, översikt |
| [HOSTING-GUIDE.md](HOSTING-GUIDE.md) | Cloudflare Tunnel, produktion |
| [EMAIL-DEBUG.md](EMAIL-DEBUG.md) | Mailpit, e-postflöden, felsökning |
| [ASSET_GENERATION_PROMPTS.md](ASSET_GENERATION_PROMPTS.md) | Prompts för bildgenerering |
| [TODO.md](../TODO.md) | Prioriterad funktionslista |
