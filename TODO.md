# TODO – Hundkrets

Prioriterad funktionslista för Hundkrets.

## Pågående

- Re-testa mobile Playwright-svit efter fixar ovan (fokus: mötesplats/geokodning, datumetiketter, `Delta`-flöde, arrangör-regel, chatt-hover, samt tidigare blockerfixar).

## Nästa

- Bekräfta att förväntade guest-flöden fortfarande fungerar på publik hundträff (`guest-public-excursion-mobile.png`) och att share-toast visas (`issue-or-proof-share-toast-mobile.png`).

## Senare

-

## Klart

- [UX/Geo] Mötesplats-sökning för `Vombsjön` geokodar nu rätt nära målet (`55.68360, 13.58949` i Playwright). Grundorsak var city-hint-bias + svag kandidatviktning; fixat med striktare city-filter (ignorera tom stad) och starkare ranking för exakt natur/platsnamn över gatuträffar.
- [QA blocker] `Utforska -> hundträffar` längdfilter: klick på vald tidsknapp fokuserar nu enbart den längden (t.ex. `8 h`) och varaktighet normaliseras robustare.
- [UX copy] Tog bort informationsblocket i Utforska > hundträffar (`Kommande promenader och träffar...`) samt CTA `Skapa eller hantera hundträffar`.
- [UX/Kort] Datum i hundträffkort är nu mer lättskannat: `Idag`, `Imorgon`, `På <veckodag>` (resten av veckan), annars kalenderdatum.
- [Språk/UI] CTA i hundträffar använder nu deltagande-språk: `Delta` / `Du deltar` (samt guest-copy uppdaterad till "Skapa konto för att delta").
- [Regel/Logik] Arrangör auto-läggs nu till som deltagare när hundträff skapas, och `Delta` visas inte för arrangören på egen hundträff.
- [UI bug] Chats-korten understryker inte längre all text vid hover; hover-markering är nu begränsad till avsedda klickbara element.
- [Explore/Karta] Hover på hundträffkort i Utforska förstorar nu motsvarande brun kartmarkör.
- [Explore/Karta] Hover på brun markör visar nu en kort tooltip med titel + tid/datum + plats direkt på kartan.
- [Navigation] Back-flödet från hundträff öppnad via Utforska återgår nu till Utforska-läget via `back` URL-state (inte `/app/excursions`).
- [Produkt/Profil] Hundträff-formuläret har nu telefon-delning via checkbox; om profiltelefon saknas kan den fyllas i direkt och sparas till profilen vid publicering/uppdatering.
- [QA blocker] `/app/excursions/:id/edit`: `Titel (egenskriven)` kan nu redigeras inline (auto-titel förblir read-only).
- [QA] Ny hundträff får framtidssäker standardtid (15:00 idag om framtid, annars nästa dag) och hamnar inte direkt i passerade-listan.
- [QA] Test-fixtures för auth uppdaterade i `TESTING.md` till seedade konton med `password123!` (i linje med README/seed-skript).
- Flytta delade utility-funktioner (`hkToId`, `hkAuthUserId`, `hkCanViewExcursion` m.fl.) till toppen av `pb_hooks/main.pb.js` och använd `hkAuthUserId` i excursion_comments-hooken
- Fixa grå Leaflet-kartor på excursion-kort och detaljsida (SolidJS `<Show>` accessor-bug: `when={meetingCoords}` → `when={meetingCoords()}` + `c.lat` → `c().lat`)
- Skapa `LocationPicker`-komponent med Leaflet-karta, dragbar markör och 1 km-cirkel. Integrerad i onboarding (`choice.tsx`) och profilredigering (`profile/edit.tsx`)
- Fixa explore-kartans initiala zoom (MatchesMap.tsx): `fitBounds` med närmaste 5 markörer på första render, `maxZoom: 13`
- Intresselista inline på excursion-detaljsidan: avatar-stack till höger om Arrangör, klickbar modal med användare + hundar (0 intresserade = ej klickbar)