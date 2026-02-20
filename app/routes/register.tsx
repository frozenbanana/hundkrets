import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [passwordConfirm, setPasswordConfirm] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

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
      const auth = await pb.collection("users").authWithPassword(email(), password());
      try {
        await pb.collection("users").update(auth.record!.id, { onboarding_complete: false });
        pb.authStore.save(pb.authStore.token!, { ...pb.authStore.model, onboarding_complete: false });
      } catch {
        /* onboarding_complete field may not exist yet—add it in PocketBase admin */
      }
      nav("/onboarding/choice", { replace: true });
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
            required
          />
        </div>
        {error() && <p class="form-error" role="alert">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>
          {loading() ? "Skapar..." : "Skapa konto"}
        </button>
      </form>
      <p style="margin-top: 1rem;">
        <A href="/login">Har du redan konto? Logga in</A>
      </p>
      </div>
    </div>
  );
}
