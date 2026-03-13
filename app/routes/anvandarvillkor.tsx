import { A } from "@solidjs/router";

export default function TermsOfService() {
  return (
    <div class="container" style="padding-top: 2rem; padding-bottom: 2rem;">
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <h1 style="margin-bottom: 1.5rem;">Användarvillkor</h1>
        <p style="color: var(--color-text-muted); margin-bottom: 2rem;">
          Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
        </p>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">1. Inledning</h2>
          <p style="line-height: 1.7;">
            Välkommen till Hundkrets! Dessa användarvillkor ("villkoren") reglerar din användning av vår plattform för ömsesidig hundpassning. Genom att skapa ett konto och använda tjänsten godkänner du dessa villkor.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">2. Tjänsten</h2>
          <p style="line-height: 1.7;">
            Hundkrets är en plattform som matchar hundägare för ömsesidig hundpassning. Tjänsten är kostnadsfri och bygger på principen att du passar någon annans hund mot att de passar din. Vi är inte en part i överenskommelser mellan användare och tar inget ansvar för genomförandet av hundpassningen.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">3. Användarkonto</h2>
          <p style="line-height: 1.7; margin-bottom: 0.5rem;">För att använda tjänsten måste du:</p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li>Vara minst 18 år eller ha förälders/vårdnadshavares samtycke</li>
            <li>Lämna korrekt och sanningsenlig information vid registrering</li>
            <li>Hålla dina inloggningsuppgifter säkra</li>
            <li>Använda ditt eget namn och din egen identitet</li>
          </ul>
          <p style="line-height: 1.7; margin-top: 1rem;">
            Du ansvarar för all aktivitet som sker under ditt konto.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">4. Användarens ansvar</h2>
          <p style="line-height: 1.7; margin-bottom: 0.5rem;">Som användare förbinder du dig att:</p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li>Ge korrekt information om dig själv, din hund och din tillgänglighet</li>
            <li>Behandla andras hundar med omsorg och respekt</li>
            <li>Följa svenska lagar och föreskrifter gällande djurhållning</li>
            <li>Kommunicera respektfullt med andra användare</li>
            <li>Inte använda plattformen för kommersiella ändamål</li>
            <li>Inte sprida falsk, stötande eller skadlig information</li>
            <li>Inte försöka skada, hacka eller störa tjänsten</li>
          </ul>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">5. Hundpassningsöverenskommelser</h2>
          <p style="line-height: 1.7;">
            Alla överenskommelser om hundpassning sker direkt mellan användare. Hundkrets är inte en part i dessa överenskommelser och tar inget ansvar för:
          </p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li>Hundens välmående under passningen</li>
            <li>Skador på person eller egendom</li>
            <li>Ekonomiska tvister mellan användare</li>
            <li>Misslyckade eller inställda passningar</li>
          </ul>
          <p style="line-height: 1.7; margin-top: 1rem;">
            Vi rekommenderar att du träffar den andra parten i förväg och diskuterar förväntningar, rutiner och eventuella problem innan passningen.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">6. Innehåll</h2>
          <p style="line-height: 1.7;">
            Du behåller äganderätten till innehåll du laddar upp (bilder, text, etc.). Genom att ladda upp innehåll ger du Hundkrets en icke-exklusiv, royaltyfri rätt att visa innehållet på plattformen i syfte att möjliggöra tjänsten.
          </p>
          <p style="line-height: 1.7; margin-top: 1rem;">
            Du garanterar att du har rätt att ladda upp innehållet och att det inte bryter mot tredje parts rättigheter.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">7. Integritet</h2>
          <p style="line-height: 1.7;">
            Din integritet är viktig för oss. Se vår <A href="/integritetspolicy">integritetspolicy</A> för information om hur vi hanterar dina personuppgifter.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">8. Ansvarsbegränsning</h2>
          <p style="line-height: 1.7;">
            Hundkrets tillhandahåller plattformen "som den är" utan garantier. Vi ansvarar inte för:
          </p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li>Tillgänglighet eller funktionalitet vid specifika tidpunkter</li>
            <li>Förlust av data eller innehåll</li>
            <li>Handlingar eller försumligheter från andra användare</li>
            <li>Indirekta skador eller följdskador</li>
          </ul>
          <p style="line-height: 1.7; margin-top: 1rem;">
            Vårt totala ansvar gentemot dig är begränsat till det belopp du betalat för tjänsten (vilket är noll, då tjänsten är kostnadsfri).
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">9. Avslutande av konto</h2>
          <p style="line-height: 1.7;">
            Du kan när som helst radera ditt konto via inställningarna i appen. Vi förbehåller oss rätten att stänga av eller radera konton som bryter mot dessa villkor eller på annat sätt skadar plattformen eller andra användare.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">10. Ändringar av villkor</h2>
          <p style="line-height: 1.7;">
            Vi kan uppdatera dessa villkor vid behov. Vid väsentliga ändringar meddelar vi dig via e-post eller genom en synlig notis i appen. Fortsatt användning av tjänsten efter ändringar innebär att du godkänner de nya villkoren.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">11. Tillämplig lag och tvister</h2>
          <p style="line-height: 1.7;">
            Dessa villkor regleras av svensk lag. Tvister ska i första hand lösas genom förhandlingar. Om detta inte lyckas, ska tvisten avgöras av svensk domstol.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">12. Kontakt</h2>
          <p style="line-height: 1.7;">
            För frågor om dessa användarvillkor, kontakta oss via appens inställningar eller via e-post.
          </p>
        </section>

        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
          <A href="/" style="color: var(--color-text-muted);">← Tillbaka till startsidan</A>
        </div>
      </div>
    </div>
  );
}