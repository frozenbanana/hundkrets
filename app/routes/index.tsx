import { A, useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";

export default function Home() {
  const nav = useNavigate();

  onMount(() => {
    if (pb.authStore.isValid) {
      nav(pb.authStore.model?.area ? "/app/matches" : "/onboarding/profile", { replace: true });
    }
  });

  return (
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Dog Watch Match</h1>
        <p style="color: var(--color-text-muted);">Find dog owners who'll watch your dog when you travel—and you watch theirs. No money, mutual help.</p>
      </div>
      <div class="card" style="text-align: center;">
        <p style="margin-bottom: 1rem;">Swap dog-sitting with neighbors. Travel worry-free.</p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <A href="/login" class="btn">Log in</A>
          <A href="/register" class="btn btn-outline">Create account</A>
        </div>
      </div>
    </div>
  );
}
