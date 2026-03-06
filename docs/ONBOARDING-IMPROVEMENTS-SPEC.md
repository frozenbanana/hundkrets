# Specifikation: Onboarding-förbättringar 1, 3, 5 och 9

Specifikation för fyra onboarding-förbättringar som minskar friction och ökar genomströmning.

---

## 1. Tvinga onboarding i AppShell

### Syfte
Förhindra att användare når `/app`-routes utan att ha slutfört onboarding. Idag kan användare skriva `/app/explore` direkt i adressfältet och komma åt appen trots att de saknar `area` och `onboarding_complete`.

### Nuvarande beteende
- `AppShell` kontrollerar endast `pb.authStore.isValid`
- Om användaren är inloggad visas appen oavsett onboarding-status
- Home, login och register redirectar till `/onboarding/choice` om inte klar, men `/app/*` har ingen sådan guard

### Önskat beteende
- När användaren är inloggad OCH försöker nå en `/app/*`-route: kontrollera om onboarding är klar
- "Klar" = `onboarding_complete === true` ELLER (`onboarding_complete !== false` OCH `area` är satt)
- Om inte klar: redirect till `/onboarding/choice` med `replace: true`

### Implementering

**Fil:** `app/src/components/AppShell.tsx`

**Ändring i `onMount`:**

```ts
onMount(() => {
  if (!pb.authStore.isValid) {
    nav("/login", { replace: true });
    return;
  }
  const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
  const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
  if (!done) {
    nav("/onboarding/choice", { replace: true });
    return;
  }
});
```

**OBS:** Använd `useLocation()` eller `useMatch()` för att undvika redirect-loop om användaren redan är på `/onboarding/*`. AppShell används endast av `/app/*`-routes, så onboarding-routes använder inte AppShell. Därför behövs ingen pathname-koll – användare som når AppShell är per definition på en `/app/*`-route.

**Edge cases:**
- Användare som loggar in och redirectas till `/onboarding/choice` från login – OK, de når aldrig AppShell
- Användare som bokmärkar `/app/explore` och öppnar när inloggade – de redirectas till `/onboarding/choice`

### Filer som påverkas
- `app/src/components/AppShell.tsx`

---

## 3. Slå ihop choice och profil

### Syfte
Minska antal steg genom att visa "Vad vill du göra?" och profilformuläret (namn + postnummer) på samma sida. Färre klick = snabbare till första matchningen.

### Nuvarande flöde
1. `/onboarding/choice` – Välj typ (has_dogs, receiver_only, sitter_only)
2. `/onboarding/profile` – Namn, postnummer, kontakt, valfritt

### Önskat flöde
1. `/onboarding/start` (ny route) eller `/onboarding/choice` (omdöpt) – Choice + namn + postnummer på samma sida
2. `/onboarding/profile` – Endast kontakt + valfritt (eller tas bort om allt flyttas)

### Alternativ A: En sida med allt
En enda sida som innehåller:
- Rubrik: "Kom igång med Hundkrets"
- Choice: Tre knappar (som idag)
- När val gjorts: Visa namn + postnummer direkt under (inline eller nedanför)
- En "Spara och fortsätt"-knapp som sparar choice + namn + postnummer

### Alternativ B: Choice först, sedan formulär på samma sida
- Choice-knappar högst upp
- När användaren klickar en knapp: sätt user type, visa namn + postnummer-formulär (ingen navigering)
- "Spara och fortsätt" → sparar och navigerar till nästa steg (dogs/capacity/needs)

### Rekommenderad approach: Alternativ B
- Behåll samma route `/onboarding/choice`
- Efter klick på choice: visa namn + postnummer-formulär på samma sida (toggle/expand)
- Ingen navigering till `/onboarding/profile` för de obligatoriska fälten
- "Spara och fortsätt" → sparar namn + postnummer + user type, navigerar till:
  - sitter_only: `/onboarding/capacity`
  - receiver_only: `/onboarding/dogs` (eller needs – kolla nuvarande flöde)
  - has_dogs: `/onboarding/dogs`

**Kontakt-sektionen (telefon, e-post-info):** Kan antingen:
- Flyttas till en kort "Steg 2" på samma sida (accordion)
- Eller flyttas till nästa steg (dogs/capacity) som en liten banner "Lägg till telefon (valfritt)"

**Valfritt (avatar, bio, raser):** Behålls på en separat "profil"-sida eller kollapsas (se punkt 5).

### Implementeringsdetaljer

**Ny struktur för `/onboarding/choice`:**

1. Visa choice-knappar
2. När `userType` är satt (via klick): visa sektion "Namn och område" med namn + PostalCodeInput
3. Knapp "Spara och fortsätt" – sparar till backend, navigerar vidare
4. `/onboarding/profile` används endast för kontakt + valfritt, ELLER slås ihop så att choice-sidan har:
   - Sektion 1: Choice
   - Sektion 2: Namn + postnummer
   - Sektion 3 (kollapsad): Kontakt + valfritt

**För att undvika för mycket på en sida:** Börja med att bara slå ihop choice + namn + postnummer. Kontakt och valfritt kan vara en "Steg 2" som visas efter att namn/postnummer sparats (samma sida, bara expandera nästa sektion) – eller navigera till en förenklad `/onboarding/profile` som bara har kontakt + valfritt.

**Filer som påverkas:**
- `app/routes/onboarding/choice.tsx` – Utökas med namn + postnummer + sparande
- `app/routes/onboarding/profile.tsx` – Förenklas till endast kontakt + valfritt, eller tas bort om allt flyttas till choice
- `app/src/lib/onboarding.ts` – Oförändrad (sessionStorage för user type)
- Routing: `/onboarding/profile` kan behållas för kontakt+valfritt, eller choice hanterar allt

**Dataflöde:**
- Vid "Spara och fortsätt" på choice: anropa `pb.collection("users").update()` med name, area, lat, lon, address_private, city, neighborhood
- Sätt `setOnboardingUserType` innan navigering
- Nästa steg: dogs, needs eller capacity beroende på user type

---

## 5. Kollapsa valfritt-avsnitt

### Syfte
Göra profilsidan visuellt lättare genom att dölja det valfria avsnittet (profilbild, bio, raser) som standard. Användaren ser bara det obligatoriska först.

### Nuvarande beteende
- Sektion "Valfritt – kan du fylla i senare i appen" visas alltid expanderad
- Innehåller: ImageCaptureInput, bio, breeds_owned_before

### Önskat beteende
- Sektionen är kollapsad (accordion) som standard
- Rubrik klickbar: "Valfritt – kan du fylla i senare i appen" med en pil/chevron
- Vid klick: expandera/kollapsa innehållet
- Visuell indikator: t.ex. "▼" när expanderad, "▶" när kollapsad

### Implementering

**Fil:** `app/routes/onboarding/profile.tsx`

**Ny state:**
```ts
const [optionalOpen, setOptionalOpen] = createSignal(false);
```

**Sektionen wrappas i en klickbar header:**
```tsx
<section style="margin-bottom: 1.5rem;">
  <button
    type="button"
    onClick={() => setOptionalOpen((o) => !o)}
    style="width: 100%; text-align: left; background: none; border: none; padding: 0; cursor: pointer; ..."
    aria-expanded={optionalOpen()}
  >
    <h2 style="...">
      Valfritt – kan du fylla i senare i appen
      <span aria-hidden="true">{optionalOpen() ? " ▼" : " ▶"}</span>
    </h2>
  </button>
  <Show when={optionalOpen()}>
    <p style="...">Hjälper andra att lära känna dig...</p>
    <ImageCaptureInput ... />
    ...
  </Show>
</section>
```

**Tillgänglighet:**
- `aria-expanded` på knappen
- `aria-controls` och `id` för att koppla ihop om behövs
- Fokus hanteras korrekt vid tangentbordsnavigering

**CSS:** Eventuellt `.onboarding-optional-section` för styling. Chevron kan vara en inline SVG eller Unicode-tecken.

### Filer som påverkas
- `app/routes/onboarding/profile.tsx`
- Eventuellt `app/app.css` för accordion-styling

---

## 9. Tydligare progress

### Syfte
Visa tydligare hur många steg som återstår och vad som kommer härnäst. Minska osäkerhet och öka motivation att slutföra.

### Nuvarande beteende
- `OnboardingShell` visar en rad med cirklar (`.onboarding-progress .step`)
- Aktuellt steg har klassen `active`, klara har `done`
- Ingen text som "Steg 1 av 4" eller beskrivning av nästa steg

### Önskat beteende
1. **Textindikator:** "Steg 1 av 4" (eller motsvarande) synlig under eller bredvid progress-cirklarna
2. **Nästa steg:** Kort text under rubriken som beskriver vad som händer härnäst, t.ex. "Nästa: Lägg till dina hundar"

### Implementering

**Fil:** `app/src/components/OnboardingShell.tsx`

**Utökade props (valfritt):**
```ts
interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
  /** Kort beskrivning av nästa steg, t.ex. "Nästa: Lägg till dina hundar" */
  nextStepHint?: string;
  backHref?: string;
  children: ...;
}
```

**Ändring i JSX:**
```tsx
<div class="onboarding-progress">
  {Array.from({ length: props.totalSteps }, (_, i) => (
    <div class={`step ${i + 1 === props.step ? "active" : ""} ${i + 1 < props.step ? "done" : ""}`} ... />
  ))}
</div>
<p class="onboarding-progress-label" aria-live="polite">
  Steg {props.step} av {props.totalSteps}
</p>
{props.nextStepHint && (
  <p class="onboarding-next-hint" style="color: var(--color-text-muted); font-size: 0.9rem; margin-top: 0.25rem;">
    {props.nextStepHint}
  </p>
)}
```

**Uppdatera anrop i varje onboarding-route:**

| Route | step | totalSteps | nextStepHint |
|-------|------|------------|--------------|
| choice | 1 | 4 (eller dynamiskt) | "Nästa: Fyll i namn och postnummer" |
| profile | 1 | 2–4 | "Nästa: Lägg till dina hundar" / "Nästa: När du kan passa" |
| dogs | 2 | 4 | "Nästa: När du behöver hundpassning" |
| needs | 3 | 4 | "Nästa: När du kan passa hundar" |
| capacity | 2 eller 4 | 2 eller 4 | "Nästa: Se matchningar" |

**OBS:** Choice har idag `totalSteps={1}` vilket ger bara en cirkel. Vid merge med profil (punkt 3) blir step-strukturen annorlunda. Progress ska reflektera det faktiska antalet steg i flödet.

**Dynamisk totalSteps:** Om sitter_only har 2 steg och has_dogs har 4, måste choice-sidan veta vilket flöde som gäller. Idag sätts user type först när man klickar – så choice kan visa "Steg 1 av 4" (default) eller "Steg 1 av 2" om vi vill. Enklast: visa alltid "Steg 1" på choice utan total (eftersom total beror på val).

**Förenklad approach:** Lägg bara till "Steg X av Y" som text. `nextStepHint` kan vara valfri.

### CSS
```css
.onboarding-progress-label {
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

.onboarding-next-hint {
  text-align: center;
  margin-bottom: 1rem;
}
```

### Filer som påverkas
- `app/src/components/OnboardingShell.tsx`
- `app/routes/onboarding/choice.tsx`
- `app/routes/onboarding/profile.tsx`
- `app/routes/onboarding/dogs.tsx`
- `app/routes/onboarding/needs.tsx`
- `app/routes/onboarding/capacity.tsx`
- `app/app.css`

---

## Sammanfattning

| # | Åtgärd | Filer | Komplexitet |
|---|--------|-------|-------------|
| 1 | Tvinga onboarding i AppShell | AppShell.tsx | Låg |
| 3 | Slå ihop choice och profil | choice.tsx, profile.tsx | Medium |
| 5 | Kollapsa valfritt-avsnitt | profile.tsx | Låg |
| 9 | Tydligare progress | OnboardingShell.tsx, alla onboarding-routes, app.css | Låg |

**Rekommenderad implementeringsordning:** 1 → 9 → 5 → 3 (enklast först, punkt 3 kräver mest omsorg pga. flödesändringar).
