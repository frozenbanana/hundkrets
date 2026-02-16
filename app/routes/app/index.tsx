import { A } from "@solidjs/router";
import { AppShell } from "~/components/AppShell";

export default function AppHome() {
  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Dashboard</h1>
        <p style="color: var(--color-text-muted);">Welcome to Dog Watch Match.</p>
      </div>
      <div class="card">
        <h2>Quick actions</h2>
        <ul>
          <li><A href="/app/profile">Complete your profile</A> (name, phone, area)</li>
          <li><A href="/app/dogs">Add your dogs</A></li>
          <li><A href="/app/needs/new">Add when you need dog watching</A></li>
          <li><A href="/app/capacity/new">Add when you can watch dogs</A></li>
          <li><A href="/app/matches">View matches</A></li>
        </ul>
      </div>
    </div>
    </AppShell>
  );
}
