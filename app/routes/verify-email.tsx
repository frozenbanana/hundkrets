import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";

export default function VerifyEmailToken() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    const token = searchParams.token;
    if (!token) {
      setError("Verifieringslänken saknar token.");
      setLoading(false);
      return;
    }
    try {
      await pb.collection("users").confirmVerification(token);
      nav("/login?verified=1", { replace: true });
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  });

  if (loading()) {
    return (
      <div class="container">
        <div class="page-hero">
          <h1>Verifierar...</h1>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <div class="page-hero">
        <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
        <h1>Verifiering misslyckades</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">
          {error()}
        </p>
      </div>
      <div class="card">
        <p style="margin-bottom: 1rem;">
          Länken kan ha gått ut eller redan använts. <A href="/register">Skapa konto igen</A> eller <A href="/login">logga in</A>.
        </p>
        <A href="/login" class="btn" style="width: 100%; display: block; text-align: center;">
          Till inloggning
        </A>
      </div>
    </div>
  );
}
