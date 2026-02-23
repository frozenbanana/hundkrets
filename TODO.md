# Hundkrets TODO

Prioriterad lista från perspektivet av en användare som söker hundpassning och en partner att göra utbyte med. Indelning i förbättringar av befintliga funktioner och helt nya funktioner.

---

## DONE – Klart

### P0 – Kritiskt
- **Inkommande förfrågningar** – Acceptera-knapp tillagd på dashboard för att matcha direkt
- **Behov och kapacitet** – Listor med `/app/needs` och `/app/capacity` inkl. redigera/ta bort
- **Språk** – Konsekvent svenska i UI (login, register, onboarding, profil, felmeddelanden)

### P1 – Hög impact
- **Onboarding "vill bara passa"** – Val i början: "Jag har hund" vs "Jag vill bara passa hundar", enklare flöde för sitter-only
- **Onboarding hundar** – Förenklat steg med tydlig primär action
- **Mobilnavigation** – Hamburger-meny för små skärmar
- **Tomt tillstånd vid ofullständig profil** – Tydlig checklista och länk till profil

### P3
- **Adressinmatning** – Förbättrad placeholder, loading states

---

## Förbättringar av befintliga funktioner

### P0 – Kritiskt
*(Inga kvar – allt klart)*

### P1 – Hög impact
#### 0. ~~Onboarding lättare att fortsätta~~ DONE
**Problem:** En användare kan ha fyllt i formuläret och sedan tyckt på fortsätt. Informationen sparas inte och man har gått vidare i onboarding utan att informationen har sparats.
**Åtgärd:** Gör det tydligt med en knappar som heter "Spara och fortsätt" och "Skippa". En tredje knapp är rimlig om man vill lägga till en till hund eller behov

#### 1. ~~Lägg till "Lägg till kapacitet"-knapp~~ DONE
**Problem:** På kapacitetssidan visas ingen "Lägg till"-knapp när användaren redan har kapacitet. Behovssidan har en sådan knapp; kapacitetssidan saknar den.

**Åtgärd:** Lägg till "Lägg till kapacitet" ovanför listan på [app/routes/app/capacity/index.tsx](app/routes/app/capacity/index.tsx), liknande behovssidan.

#### 2. ~~Success feedback (toasts)~~ DONE
**Problem:** Efter "Intresse skickat", "Profil sparad" eller liknande är feedbacken minimal.

**Åtgärd:** Lägg till korta success-meddelanden (t.ex. toast eller inline) så att användaren säkerställer att åtgärden lyckades.

### P2 – Medium impact

#### 3. Förklara matchningsmodellen
**Problem:** Det är inte uppenbart att matchningar bygger på kompletterande behov och kapacitet (du behöver passning när de kan erbjuda, och vice versa).

**Åtgärd:** Lägg till en kort förklaring på matchningssidan eller i tooltip: "Du ser personer som har behov eller kapacitet som matchar dina."

#### 4. Sortering efter bästa match
**Problem:** Listan sorteras bara på avstånd. Användaren ser inte först de som har datumöverlappning (bästa match).

**Åtgärd:** Sortera matchningar så att de med datumöverlappning visas först, sedan avstånd.

#### 5. Justera max avstånd
**Problem:** Användaren kan inte ändra max avstånd (default 100 km). Vissa vill söka vidare, andra vill begränsa till närområdet.

**Åtgärd:** Lägg till en slider eller dropdown för att välja max avstånd (t.ex. 10, 25, 50, 100 km).

#### 6. Nav-labels: "Behov" / "Kapacitet"
**Problem:** Nav-länkarna "Mina behov" och "Min kapacitet" pekar på översiktssidor, men namnen kan tydligare signalera att man kan hantera flera poster.

**Åtgärd:** Överväg att behålla nuvarande namn eller omdöpa till "Behov" / "Kapacitet" med tydlig "Lägg till"-action på sidorna.

#### 7. Gör match-kort lättare att skanna
**Problem:** Match-kort visar mycket text; plats, datum och hundinfo kan vara svåra att skanna snabbt.

**Åtgärd:** Tydligare typografihierarki, små etiketter, eventuellt expand/collapse för långt innehåll.

### P3 – Nice to have

#### 8. Bekräftelse före avmatchning
**Problem:** "Avmatcha" har ingen bekräftelse – lätt att avmatcha av misstag.

**Åtgärd:** Lägg till bekräftelsedialog: "Är du säker? Ni kommer inte längre se varandras kontaktuppgifter."

#### 9. Landing page – värdet för "vill bara passa"
**Problem:** Landningssidan är tydlig för hundägare, men värdet för personer som bara vill passa hundar kan stärkas.

**Åtgärd:** Lägg till en rad: "Även om du inte har hund – passa andras hundar och bygg upp kredibilitet för framtida utbyten."

---

## Helt nya funktioner

### P1 – Hög impact

#### 10. Notifieringar (email/push)
**Problem:** Användaren får ingen notis när någon skickar förfrågan eller matchar. Man måste aktivt kolla appen.

**Åtgärd:** Email-notifieringar vid ny förfrågan och matchning. Eventuellt push för mobil.

### P2 – Medium impact

#### 11. In-app meddelanden
**Problem:** Efter matchning måste man använda telefon/email direkt. Ingen inbyggd chatt.

**Åtgärd:** Enkel in-app meddelandefunktion för matchade så att användaren kan koordinera innan de byter kontaktuppgifter.

#### 12. Bokningskalender
**Problem:** Ingen översikt över egna behov och kapacitet över tid. Svårt att se överlappningar och planera.

**Åtgärd:** Kalendervy som visar egna behov och kapacitet, eventuellt med matchade partners datum.

#### 13. Påminnelser
**Problem:** Användaren får ingen påminnelse när ett behov går ut snart eller när kapacitet är nära.

**Åtgärd:** Påminnelser: "Ditt behov går ut om 3 dagar", "Din kapacitet börjar på fredag."

### P3 – Nice to have

#### 14. Reputation/feedback
**Problem:** Ingen rating eller feedback efter genomförd passning. Svårt att lita på nya personer.

**Åtgärd:** Enkel feedback/rating efter passning (t.ex. "Bra passning" + kort kommentar). Visa antal genomförda utbyten.

#### 15. Profilverifiering
**Problem:** Ingen verifiering av identitet eller profil. Kan minska förtroende.

**Åtgärd:** Enkel verifiering (t.ex. email, telefon, eller valfri metod) – markera verifierade profiler med badge.

---

## Sammanfattning

| Prioritet | Uppgift | Effort |
|-----------|---------|--------|
| P1 | Lägg till "Lägg till kapacitet"-knapp | Liten |
| P1 | Success feedback (toasts) | Liten |
| P1 | Notifieringar (email/push) | Stor |
| P2 | Förklara matchningsmodellen | Liten |
| P2 | Sortering efter bästa match | Liten |
| P2 | Justera max avstånd | Liten |
| P2 | Nav-labels Behov/Kapacitet | Liten |
| P2 | Match-kort lättare att skanna | Medium |
| P2 | In-app meddelanden | Stor |
| P2 | Bokningskalender | Stor |
| P2 | Påminnelser | Medium |
| P3 | Bekräftelse före avmatchning | Liten |
| P3 | Landing page sitter-only value | Liten |
| P3 | Reputation/feedback | Stor |
| P3 | Profilverifiering | Medium |

---

**Föreslagen ordning:** Börja med P1 (särskilt "Lägg till kapacitet"-knapp och success feedback), sedan P2 för störst användarimpact. Notifieringar och in-app meddelanden kräver mer backend-arbete men ger hög värde.
