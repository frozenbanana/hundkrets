# Hundkrets – Dokumentation

Översikt över dokumentationen i detta repo.

## Dokument

| Dokument | Beskrivning |
|----------|-------------|
| [**ARCHITECTURE.md**](ARCHITECTURE.md) | **Starta här.** Komplett guide: tech stack, datamodell, dataflöden, PocketBase SDK, frontend-mönster, säkerhet. |
| [HOSTING-GUIDE.md](HOSTING-GUIDE.md) | Cloudflare Tunnel, Docker Compose, produktion. |
| [EMAIL-DEBUG.md](EMAIL-DEBUG.md) | Mailpit, e-postflöden, felsökning. |
| [ASSET_GENERATION_PROMPTS.md](ASSET_GENERATION_PROMPTS.md) | Prompts för bildgenerering (favicon, og-image, etc.). |

## Snabbstart för utvecklare

1. **Läs [ARCHITECTURE.md](ARCHITECTURE.md)** för att förstå projektet
2. **Starta PocketBase:** `./pocketbase serve`
3. **Starta frontend:** `cd app && npm run dev`
4. **Öppna:** http://localhost:3000

## Övrigt

- [../README.md](../README.md) – Setup, snabbstart, deploy
- [../TODO.md](../TODO.md) – Prioriterad funktionslista
