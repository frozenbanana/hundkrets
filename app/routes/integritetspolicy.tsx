import { A } from "@solidjs/router";

export default function PrivacyPolicy() {
  return (
    <div class="container" style="padding-top: 2rem; padding-bottom: 2rem;">
      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <h1 style="margin-bottom: 1.5rem;">Integritetspolicy</h1>
        <p style="color: var(--color-text-muted); margin-bottom: 2rem;">
          Senast uppdaterad: {new Date().toLocaleDateString('sv-SE')}
        </p>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">1. Inledning</h2>
          <p style="line-height: 1.7;">
            Hundkrets ("vi", "oss" eller "tjänsten") värnar om din integritet. Denna integritetspolicy beskriver hur vi samlar in, använder och skyddar dina personuppgifter när du använder vår plattform för hundpassningsutbyte.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">2. Vilka uppgifter vi samlar in</h2>
          <p style="line-height: 1.7; margin-bottom: 0.5rem;">Vi samlar in följande personuppgifter:</p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li><strong>Kontoinformation:</strong> Namn, e-postadress, profilbild</li>
            <li><strong>Platsinformation:</strong> Postnummer, ort, geografiska koordinater (för att matcha dig med andra hundägare i närheten)</li>
            <li><strong>Hundinformation:</strong> Din hunds namn, ras, ålder, storlek, temperament och bilder</li>
            <li><strong>Passningsinformation:</strong> Dina behov och kapacitet för hundpassning, inklusive datum</li>
            <li><strong>Kommunikation:</strong> Meddelanden du skickar till andra användare via plattformen</li>
            <li><strong>Autentiseringsdata:</strong> Om du loggar in via Google, lagrar vi din Google-användaridentifierare</li>
          </ul>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">3. Hur vi använder dina uppgifter</h2>
          <p style="line-height: 1.7; margin-bottom: 0.5rem;">Vi använder dina personuppgifter för att:</p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li>Matcha dig med andra hundägare baserat på plats och tillgänglighet</li>
            <li>Visa din profil och dina hundar för andra användare</li>
            <li>Möjliggöra kommunikation mellan användare</li>
            <li>Skicka relevanta notiser och uppdateringar</li>
            <li>Förbättra och utveckla tjänsten</li>
            <li>Säkerställa plattformens säkerhet och integritet</li>
          </ul>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">4. Delning av uppgifter</h2>
          <p style="line-height: 1.7;">
            Vi säljer aldrig dina personuppgifter. Vi delar endast information med:
          </p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li><strong>Andra användare:</strong> Din profil, plats (ungefärlig), och hundinformation visas för att möjliggöra matchningar</li>
            <li><strong>Tjänsteleverantörer:</strong> Värdtjänster och infrastruktur som krävs för att driva plattformen</li>
            <li><strong>Myndigheter:</strong> Om lag kräver det</li>
          </ul>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">5. Dina rättigheter</h2>
          <p style="line-height: 1.7; margin-bottom: 0.5rem;">Du har rätt att:</p>
          <ul style="line-height: 1.8; margin-left: 1.5rem;">
            <li>Begära tillgång till dina personuppgifter</li>
            <li>Rätta felaktiga uppgifter</li>
            <li>Begära radering av dina uppgifter ("rätten att bli glömd")</li>
            <li>Invända mot behandling av dina uppgifter</li>
            <li>Begära dataportabilitet</li>
            <li>Dra tillbaka ditt samtycke när som helst</li>
          </ul>
          <p style="line-height: 1.7; margin-top: 1rem;">
            För att utöva dina rättigheter, kontakta oss via inställningarna i appen eller via e-post.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">6. Datalagring och säkerhet</h2>
          <p style="line-height: 1.7;">
            Dina uppgifter lagras på servrar inom EU. Vi använder branschstandard för säkerhet, inklusive kryptering av dataöverföring (HTTPS) och säker autentisering. Vi behåller dina uppgifter så länge du har ett aktivt konto, eller tills du begär radering.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">7. Cookies och spårning</h2>
          <p style="line-height: 1.7;">
            Vi använder nödvändiga cookies för autentisering och sessionshantering. Vi använder inte spårningscookies eller tredjepartsanalys.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">8. Ändringar av policyn</h2>
          <p style="line-height: 1.7;">
            Vi kan uppdatera denna integritetspolicy vid behov. Vi meddelar väsentliga ändringar via e-post eller genom en synlig notis i appen.
          </p>
        </section>

        <section style="margin-bottom: 2rem;">
          <h2 style="margin-bottom: 1rem;">9. Kontakt</h2>
          <p style="line-height: 1.7;">
            För frågor om denna integritetspolicy eller dina personuppgifter, kontakta oss via appens inställningar eller via e-post.
          </p>
        </section>

        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
          <A href="/" style="color: var(--color-text-muted);">← Tillbaka till startsidan</A>
        </div>
      </div>
    </div>
  );
}