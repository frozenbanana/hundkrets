# E-post vid intresseanmälan – felsökning

## Problemet

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
