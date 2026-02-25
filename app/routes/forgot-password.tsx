import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await pb.collection("users").requestPasswordReset(email());
      setSuccess(true);
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (success()) {
    return (
      <div class="container">
        <div class="page-hero">
          <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
          <h1>Kolla din e-post</h1>
          <p style="color: var(--color-text-muted); font-size: 0.95rem;">
            Vi har skickat en länk för att återställa lösenordet till {email()}. Klicka på länken i mailet för att ange ett nytt lösenord.
          </p>
        </div>
        <div class="card">
          <p style="margin-bottom: 1rem;">
            Har du inte fått mailet? Kolla skräppostmappen eller <A href="/forgot-password">försök igen</A>.
          </p>
          <A href="/login" class="btn" style="width: 100%; display: block; text-align: center;">
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
        <h1>Glömt lösenord</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">
          Ange din e-postadress så skickar vi en länk för att återställa lösenordet.
        </p>
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
              placeholder="din@epost.se"
              required
            />
          </div>
          {error() && <p class="form-error" role="alert">{error()}</p>}
          <button type="submit" class="btn" style="width: 100%;" disabled={loading()}>
            {loading() ? "Skickar..." : "Skicka återställningslänk"}
          </button>
        </form>
        <p style="margin-top: 1rem;">
          <A href="/login">Tillbaka till inloggning</A>
        </p>
      </div>
    </div>
  );
}
