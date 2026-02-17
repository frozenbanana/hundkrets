import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const auth = await pb.collection("users").authWithPassword(email(), password());
      const m = auth.record as { onboarding_complete?: boolean; area?: string } | null;
      const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
      nav(done ? "/app/matches" : "/onboarding/profile", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="container">
      <div class="page-hero">
        <img src="/logo-icon.png" alt="Hundkrets" width="48" height="48" style="border-radius: 10px;" />
        <h1>Hundkrets</h1>
        <p style="color: var(--color-text-muted); font-size: 0.95rem;">Logga in</p>
      </div>
      <div class="card">
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            required
          />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
          />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>
          {loading() ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p style="margin-top: 1rem;">
        <A href="/register">Create an account</A>
      </p>
      </div>
    </div>
  );
}
