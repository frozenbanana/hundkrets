import { A } from "@solidjs/router";
import { AppShell } from "~/components/AppShell";

export default function AppHome() {
  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Översikt</h1>
        <p style="color: var(--color-text-muted);">Välkommen till Dog Watch Match.</p>
      </div>
      <div class="card">
        <h2>Snabbåtgärder</h2>
        <ul>
          <li><A href="/app/profile">Fyll i din profil</A> (namn, telefon, område)</li>
          <li><A href="/app/dogs">Lägg till dina hundar</A></li>
          <li><A href="/app/needs/new">Lägg till när du behöver hundpassning</A></li>
          <li><A href="/app/capacity/new">Lägg till när du kan passa hundar</A></li>
          <li><A href="/app/matches">Se matchningar</A></li>
        </ul>
      </div>
    </div>
    </AppShell>
  );
}
