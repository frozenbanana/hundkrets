import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";
import { handleOAuthRedirect } from "~/lib/oauth";

export default function Login() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [oauthLoading, setOauthLoading] = createSignal(false);

  onMount(() => {
    if (searchParams.verified === "1") {
      setSuccess("Din e-post är verifierad. Du kan nu logga in.");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const auth = await pb.collection("users").authWithPassword(email(), password());
      const m = auth.record as { onboarding_complete?: boolean; area?: string } | null;
      const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
      nav(done ? "/app/matches" : "/onboarding/choice", { replace: true });
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="container">
      <div class="page-hero">
        <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
        <h1>Hundkrets</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">Logga in på ditt konto</p>
      </div>
      <div class="card">
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="email">E-post</label>
          <input
            id="email"
            type="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            required
          />
        </div>
        <div class="form-group">
          <label for="password">Lösenord</label>
          <input
            id="password"
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
          />
        </div>
        {success() && <p style="color: #16a34a; margin-bottom: 0.5rem;" role="status">{success()}</p>}
        {error() && <p class="form-error" role="alert">{error()}</p>}
        <button type="submit" class="btn" style="width: 100%;" disabled={loading()}>
          {loading() ? "Loggar in..." : "Logga in"}
        </button>
      </form>
      <div style="margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <span style="flex: 1; height: 1px; background: var(--color-border);" />
        <span style="color: var(--color-text-muted); font-size: 0.85rem;">eller</span>
        <span style="flex: 1; height: 1px; background: var(--color-border);" />
      </div>
      <button
        type="button"
        class="btn btn-outline"
        style="margin-top: 1rem; width: 100%;"
        disabled={oauthLoading()}
        onClick={() => {
          setOauthLoading(true);
          setError("");
          pb.collection("users")
            .authWithOAuth2({ provider: "google" })
            .then(() => handleOAuthRedirect(nav))
            .catch((err: unknown) => setError(parseApiError(err)))
            .finally(() => setOauthLoading(false));
        }}
      >
        {oauthLoading() ? "Loggar in..." : "Fortsätt med Google"}
      </button>
      <p style="margin-top: 1rem;">
        <A href="/register">Skapa konto</A>
      </p>
      </div>
    </div>
  );
}
