import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";

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
      setError("Passwords do not match");
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
      nav("/onboarding/profile", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Create account</h1>
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
            minLength={8}
          />
        </div>
        <div class="form-group">
          <label for="passwordConfirm">Confirm password</label>
          <input
            id="passwordConfirm"
            type="password"
            value={passwordConfirm()}
            onInput={(e) => setPasswordConfirm(e.currentTarget.value)}
            required
          />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>
          {loading() ? "Creating..." : "Create account"}
        </button>
      </form>
      <p style="margin-top: 1rem;">
        <A href="/login">Already have an account? Log in</A>
      </p>
      </div>
    </div>
  );
}
