import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";
import { handleOAuthRedirect } from "~/lib/oauth";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [passwordConfirm, setPasswordConfirm] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [oauthLoading, setOauthLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    if (password() !== passwordConfirm()) {
      setError("Lösenorden matchar inte");
      return;
    }
    setLoading(true);
    try {
      await pb.collection("users").create({
        email: email(),
        password: password(),
        passwordConfirm: passwordConfirm(),
      });
      await pb.collection("users").authWithPassword(email(), password());
      await pb.collection("users").requestVerification(email());
      const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
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
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">Skapa konto</p>
      </div>
      <div class="card">
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="email">E-post</label>
          <input
            id="email"
            type="email"
            autocomplete="email"
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
            autocomplete="new-password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
            minLength={8}
          />
        </div>
        <div class="form-group">
          <label for="passwordConfirm">Bekräfta lösenord</label>
          <input
            id="passwordConfirm"
            type="password"
            autocomplete="new-password"
            value={passwordConfirm()}
            onInput={(e) => setPasswordConfirm(e.currentTarget.value)}
            required
          />
        </div>
        {error() && <p class="form-error" role="alert">{error()}</p>}
        <button type="submit" class="btn" style="width: 100%;" disabled={loading()}>
          {loading() ? "Skapar..." : "Skapa konto"}
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
        {oauthLoading() ? "Skapar konto..." : "Fortsätt med Google"}
      </button>
      <p style="margin-top: 1rem;">
        <A href="/login">Har du redan konto? Logga in</A>
      </p>
      </div>
    </div>
  );
}
