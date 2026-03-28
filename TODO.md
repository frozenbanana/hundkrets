# TODO – Hundkrets

Prioriterad funktionslista för Hundkrets.

## Pågående

- Utreda varför `excursion_comments` collection returnerar 400 vid create (PocketBase framework-nivå, hooks triggas aldrig). Troligtvis schema-diff mellan migrationer och live-databas.

## Nästa

-

## Senare

-

## Klart

- Flytta delade utility-funktioner (`hkToId`, `hkAuthUserId`, `hkCanViewExcursion` m.fl.) till toppen av `pb_hooks/main.pb.js` och använd `hkAuthUserId` i excursion_comments-hooken
- Fixa grå Leaflet-kartor på excursion-kort och detaljsida (SolidJS `<Show>` accessor-bug: `when={meetingCoords}` → `when={meetingCoords()}` + `c.lat` → `c().lat`)
- Skapa `LocationPicker`-komponent med Leaflet-karta, dragbar markör och 1 km-cirkel. Integrerad i onboarding (`choice.tsx`) och profilredigering (`profile/edit.tsx`)
- Fixa explore-kartans initiala zoom (MatchesMap.tsx): `fitBounds` med närmaste 5 markörer på första render, `maxZoom: 13`
- Intresselista inline på excursion-detaljsidan: avatar-stack till höger om Arrangör, klickbar modal med användare + hundar (0 intresserade = ej klickbar)