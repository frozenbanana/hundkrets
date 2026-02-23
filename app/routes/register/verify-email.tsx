import { A } from "@solidjs/router";

export default function VerifyEmail() {
  return (
    <div class="container">
      <div class="page-hero">
        <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
        <h1>Kolla din e-post</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">
          Vi har skickat ett verifieringsmail till din e-postadress. Klicka på länken i mailet för att aktivera ditt konto.
        </p>
      </div>
      <div class="card">
        <p style="margin-bottom: 1rem;">
          Har du inte fått mailet? Kolla skräppostmappen eller försök <A href="/register">skapa konto igen</A>.
        </p>
        <A href="/login" class="btn" style="width: 100%; display: block; text-align: center;">
          Till inloggning
        </A>
      </div>
    </div>
  );
}
