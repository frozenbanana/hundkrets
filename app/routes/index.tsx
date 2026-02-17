import { A, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { DogGallery } from "~/components/DogGallery";
import { LandingMap } from "~/components/LandingMap";

export default function Home() {
  const nav = useNavigate();

  onMount(() => {
    if (pb.authStore.isValid) {
      const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
      const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
      nav(done ? "/app/matches" : "/onboarding/profile", { replace: true });
    }
  });

  return (
    <div class="landing-page">
      <div class="container">
        <div class="page-hero landing-hero">
          <h1><img src="/logo-icon.png" alt="Hundkrets" class="hero-logo" /></h1>
          <p class="landing-tagline">Hitta din partner. Helt gratis!</p>
          <p class="landing-sub">Byt hundpassning med grannar—du passar deras hund, de passar din. Inga pengar, bara ömsesidig hjälp.</p>
        </div>
        <DogGallery />
        <LandingMap style={{ height: "280px" }} />
        <div class="landing-cta">
          <p class="landing-cta-text">Res bekymmersfritt. Skapa konto och hitta hundägare i ditt område.</p>
          <div class="landing-cta-buttons">
            <A href="/register" class="btn btn-landing-primary">Skapa konto</A>
            <A href="/login" class="btn btn-outline">Logga in</A>
          </div>
        </div>
      </div>
    </div>
  );
}
