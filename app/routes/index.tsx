import { A, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isOnboardingDone } from "~/lib/onboarding";
import { DogGallery } from "~/components/DogGallery";
import { LandingMap } from "~/components/LandingMap";

export default function Home() {
  const nav = useNavigate();

  onMount(() => {
    if (pb?.authStore?.isValid) {
      const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
      nav(isOnboardingDone(m) ? "/app/explore" : "/onboarding/choice", { replace: true });
    }
  });

  return (
    <div class="landing-page">
      <div class="landing-atmosphere" aria-hidden="true" />
      <div class="container">
        <div class="page-hero landing-hero">
          <h1>
            <img src="/logo-icon.png" alt="Hundkrets" class="hero-logo" />
          </h1>
          <p class="landing-tagline">Byt hundpassning med grannar. Helt gratis.</p>
          <p class="landing-sub">
            Du passar deras hund, de passar din. Inga pengar—bara ömsesidig hjälp i ditt område.
          </p>
          <p class="landing-sub" style="margin-top: 0.5rem;">
            Även utan egen hund kan du passa andras och bygga förtroende inför framtida utbyten.
          </p>
        </div>
        <div class="landing-cta">
          <p class="landing-cta-text">Skapa konto och hitta hundägare nära dig.</p>
          <div class="landing-cta-buttons">
            <A href="/register" class="btn btn-landing-primary">
              Skapa konto
            </A>
            <A href="/login" class="btn btn-outline">
              Logga in
            </A>
          </div>
        </div>
        <DogGallery />
        <LandingMap style={{ height: "280px" }} />
        <footer class="landing-footer">
          <p>
            <A href="/integritetspolicy">Integritetspolicy</A>
            <span style="margin: 0 0.5rem; color: var(--color-text-muted);">•</span>
            <A href="/anvandarvillkor">Användarvillkor</A>
          </p>
        </footer>
      </div>
    </div>
  );
}
