import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

export default function ResetPassword() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = () => searchParams.token;
  const [password, setPassword] = createSignal("");
  const [passwordConfirm, setPasswordConfirm] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const t = token();
    if (!t) {
      setError("Återställningslänken saknar token.");
      return;
    }
    if (password() !== passwordConfirm()) {
      setError("Lösenorden matchar inte");
      return;
    }
    if (password().length < 8) {
      setError("Lösenordet måste vara minst 8 tecken");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await pb.collection("users").confirmPasswordReset(t, password(), passwordConfirm());
      showToast("Lösenordet har återställts. Du kan nu logga in.");
      nav("/login?passwordReset=1", { replace: true });
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
            Länken för att återställa lösenord saknar token. <A href="/forgot-password">Begär ny återställningslänk</A>.
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
        <h1>Ange nytt lösenord</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem; margin: 0.5rem 0 0;">
          Skriv in ditt nya lösenord nedan.
        </p>
      </div>
      <div class="card">
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="password">Nytt lösenord</label>
            <input
              id="password"
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="Minst 8 tecken"
              autocomplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div class="form-group">
            <label for="passwordConfirm">Bekräfta lösenord</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm()}
              onInput={(e) => setPasswordConfirm(e.currentTarget.value)}
              placeholder="Samma lösenord igen"
              autocomplete="new-password"
              required
            />
          </div>
          {error() && <p class="form-error" role="alert">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()} style="width: 100%;">
            {loading() ? "Återställer..." : "Återställ lösenord"}
          </button>
        </form>
        <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--color-text-muted);">
          <A href="/login">Avbryt och gå till inloggning</A>
        </p>
      </div>
    </div>
  );
}
