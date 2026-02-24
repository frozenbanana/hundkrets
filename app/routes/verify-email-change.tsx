import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

export default function VerifyEmailChange() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = () => searchParams.token;
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const t = token();
    if (!t) {
      setError("Verifieringslänken saknar token.");
      return;
    }
    if (!password().trim()) {
      setError("Ange ditt lösenord.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await pb.collection("users").confirmEmailChange(t, password());
      showToast("Din e-postadress har uppdaterats. Logga in med din nya e-post.");
      nav("/login?emailChanged=1", { replace: true });
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (!token()) {
    return (
      <div class="container">
        <div class="page-hero">
          <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
          <h1>Ogiltig länk</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">
            Länken för att byta e-post saknar token. <A href="/login">Logga in</A> och försök igen från inställningarna.
          </p>
          <A href="/login" class="btn" style="width: 100%; display: block; text-align: center; margin-top: 1rem;">
            Till inloggning
          </A>
        </div>
      </div>
    );
  }

  return (
    <div class="container">
      <div class="page-hero">
        <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
        <h1>Bekräfta ny e-post</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem; margin: 0.5rem 0 0;">
          Ange ditt lösenord för att slutföra e-postbytet.
        </p>
      </div>
      <div class="card">
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="password">Lösenord</label>
            <input
              id="password"
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Ditt lösenord"
              autocomplete="current-password"
              required
            />
          </div>
          {error() && <p class="form-error" role="alert">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()} style="width: 100%;">
            {loading() ? "Bekräftar..." : "Bekräfta e-postbyte"}
          </button>
        </form>
        <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--color-text-muted);">
          <A href="/login">Avbryt och gå till inloggning</A>
        </p>
      </div>
    </div>
  );
}
