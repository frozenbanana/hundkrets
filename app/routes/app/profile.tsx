import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

export default function Profile() {
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [area, setArea] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [saved, setSaved] = createSignal(false);

  onMount(() => {
    const user = pb.authStore.model;
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setArea(user.area ?? "");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSaved(false);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      await pb.collection("users").update(userId, {
        name: name(),
        phone: phone(),
        area: area(),
      });
      pb.authStore.save(pb.authStore.token, { ...pb.authStore.model, name: name(), phone: phone(), area: area() });
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <h1>Profile</h1>
      <p>Set your name, phone, and area for matching. These are visible to other users when you match.</p>
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="name">Name</label>
          <input
            id="name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label for="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label for="area">Area (city/neighborhood)</label>
          <input
            id="area"
            type="text"
            value={area()}
            onInput={(e) => setArea(e.currentTarget.value)}
            required
          />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        {saved() && <p style="color: #16a34a;">Profile saved.</p>}
        <button type="submit" class="btn" disabled={loading()}>
          {loading() ? "Saving..." : "Save profile"}
        </button>
      </form>
    </div>
    </AppShell>
  );
}
