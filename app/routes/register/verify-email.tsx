import { A, useSearchParams } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const emailFromUrl = () => searchParams.email || "";
  const [email, setEmail] = createSignal(emailFromUrl());
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  async function handleResend() {
    const addr = email().trim() || emailFromUrl();
    if (!addr) {
      setError("Ange din e-postadress för att skicka en ny länk.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await pb.collection("users").requestVerification(addr);
      setSuccess(true);
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
        <h1>Kolla din e-post</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">
          Vi har skickat ett verifieringsmail till din e-postadress. Klicka på länken i mailet för att aktivera ditt konto.
        </p>
      </div>
      <div class="card">
        <p style="margin-bottom: 1rem;">
          Har du inte fått mailet? Kolla skräppostmappen eller försök <A href="/register">skapa konto igen</A>.
        </p>
        {!emailFromUrl() && (
          <div class="form-group" style="margin-bottom: 1rem;">
            <label for="resend-email">E-post</label>
            <input
              id="resend-email"
              type="email"
              autocomplete="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="din@epost.se"
            />
          </div>
        )}
        {success() && <p style="color: #16a34a; margin-bottom: 0.5rem;" role="status">Ny länk skickad! Kolla din e-post.</p>}
        {error() && <p class="form-error" role="alert" style="margin-bottom: 0.5rem;">{error()}</p>}
        <button type="button" class="btn btn-outline" style="width: 100%; margin-bottom: 1rem;" disabled={loading()} onClick={handleResend}>
          {loading() ? "Skickar..." : "Skicka ny länk"}
        </button>
        <A href="/login" class="btn" style="width: 100%; display: block; text-align: center;">
          Till inloggning
        </A>
      </div>
    </div>
  );
}
