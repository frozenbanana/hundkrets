# E-post – felsökning och testning

Felsökning och testning av e-postflöden i Hundkrets. Se [ARCHITECTURE.md](ARCHITECTURE.md) för översikt över hur e-post triggas via PocketBase-hooks.

---

## Mailpit (dev inbox)

För lokal testning av e-postflöden kan du använda **Mailpit** – en SMTP-server som fångar alla mail och visar dem i en web UI.

### Starta Mailpit

PocketBase kräver TLS (Auto/StartTLS) – Mailpit måste köras med certifikat. PocketBase verifierar certifikat och accepterar inte self-signed om certet inte är betrott i systemet.

**1. Skapa certifikat** (en gång):

```bash
./scripts/mailpit-certs.sh
```

**2. Gör certet betrott** (PocketBase kräver detta):

Alternativ A – mkcert (skapar direkt betrodda certs):

```bash
# Debian/Ubuntu: sudo apt install mkcert
# macOS: brew install mkcert
./scripts/mailpit-certs.sh   # använder mkcert om installerat
```

Alternativ B – lägg till openssl-cert i systemets trust store:

```bash
sudo cp mailpit-certs/cert.pem /usr/local/share/ca-certificates/mailpit-dev.crt
sudo update-ca-certificates
```

Starta om PocketBase efter att certet lagts till.

**3. Starta Mailpit**

Med Docker Compose:

```bash
docker compose --profile dev up -d
```

Utan Docker (lokalt `./pocketbase serve`), efter att certet lagts till i trust store:

```bash
docker run -d -p 8025:8025 -p 1025:1025 \
  -v $(pwd)/mailpit-certs:/certs:ro \
  -e MP_SMTP_TLS_CERT=/certs/cert.pem \
  -e MP_SMTP_TLS_KEY=/certs/key.pem \
  -e MP_SMTP_AUTH_ACCEPT_ANY=1 \
  --name mailpit axllent/mailpit
```

Web UI: **http://localhost:8025**

### Konfigurera PocketBase

1. Öppna PocketBase Admin (t.ex. http://localhost:8099 eller http://localhost:8090)
2. **Settings** → **Mail settings**
3. Sätt:
   - **Host:** `mailpit` (om PocketBase körs i Docker) eller `localhost` (om PocketBase körs lokalt)
   - **Port:** `1025`
   - **TLS:** Auto (StartTLS)
   - **Username/Password:** tomma
   - **AUTH method:** Om det finns "None" eller "Off", välj det. Annars lämna PLAIN med tomma fält.

### API för programmatisk testning

Mailpit har ett REST API för att verifiera att mail skickats:

```bash
# Lista alla mottagna mail
curl http://localhost:8025/api/v1/messages

# Hämta ett specifikt mail (ersätt ID)
curl http://localhost:8025/api/v1/message/{id}
```

### Automatiska e-posttester

Kör integrationstester som verifierar att alla mailflöden skickar rätt e-post:

```bash
cd app && npm run test:email
```

Kräver: PocketBase + Mailpit igång, Mail settings konfigurerade, Sender address satt. Seed-användare (*@example.com) markeras som verifierade via migration – starta om PocketBase en gång för att köra migrationen. Testerna verifierar:

- Intresseanmälan (connection request)
- Matchbekräftelse (båda användare)
- Välkomstmail
- Chattnotis (instant)
- Återställ lösenord (reset password)
- E-postverifiering (verification)
- Bekräfta e-postbyte (confirm email change)
- Login alert (ny inloggning – migration `1739622700_enable_auth_alert.js` aktiverar detta, eller manuellt i Collection > users > Options)

Chattnotis-testet loggar in som userA och skapar meddelandet via `pb.collection("messages").create()` (collection rules kräver sender = @request.auth.id). Hooken körs och skickar mailet.

### Schema (messages & conversations)

Messages kräver: `conversation` (relation till conversations), `sender` (relation till users), `body`. Fältet `read_at` är valfritt.

Conversations kräver: `user_a`, `user_b` (båda relationer till users). `pair_key` sätts av hooken. Conversations får endast skapas mellan ömsesidigt matchade användare (båda connection_requests måste finnas).

**Messages createRule:** `@request.auth.id != '' && sender = @request.auth.id` (utan conversation-kontroll för att undvika 400).

**Conversations createRule:** `@request.auth.id != '' && (user_a = @request.auth.id || user_b = @request.auth.id)`.

---

## Problemet (intresseanmälan)

När en användare skickar en intresseanmälan (klickar "Jag är intresserad") ska mottagaren få ett e-post. Mailet skickades inte, och inga loggar syntes.

## Orsak

I `pb_hooks/main.pb.js` användes `e.collection` i hooken:

```javascript
if (!e || !e.collection || e.collection.name !== "connection_requests") {
  e.next();
  return;
}
```

**RecordEvent** i PocketBase har inte `e.collection`. Den har `app`, `context`, `record`, `type`. Därför var `e.collection` alltid `undefined`, `!e.collection` blev `true`, och hooken returnerade direkt – innan någon logg eller e-post skickades.

## Lösning

Kontrollen byttes till att bara använda `e.record`. Filtrering på collection görs redan via andra parametern till `onRecordAfterCreateSuccess`:

```javascript
onRecordAfterCreateSuccess((e) => {
  if (!e || !e.record) {
    e.next();
    return;
  }
  // ... resten av hooken
}, "connection_requests");  // <-- filtrerar på collection här
```

## Flöde (efter fix)

1. Användare klickar "Jag är intresserad" → `pb.collection("connection_requests").create({...})`
2. PocketBase skapar posten och triggar `onRecordAfterCreateSuccess` för `connection_requests`
3. Hooken körs, loggar "Connection request created, preparing email"
4. `mailFrom()` hämtar avsändare från Settings → Meta → Sender address
5. `sendMailSafe()` skickar mailet via SMTP (Settings → Mail settings)
6. Logg: "Email sent" eller "Email send failed"

## Krav för att e-post ska skickas

- **Settings → Meta → Sender address** – måste vara satt
- **Settings → Mail settings** – SMTP konfigurerat
- Hooken måste köras (ingen tidig return p.g.a. felaktig `e.collection`-kontroll)

## Verifiera

Efter deploy, skicka en intresseanmälan och kör:

```bash
sudo docker compose logs pocketbase --tail 50
```

Förväntade loggar:

- `Connection request created, preparing email`
- `Email sent` (eller `Email send failed` med felmeddelande)
