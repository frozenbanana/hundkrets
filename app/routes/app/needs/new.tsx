import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

export default function NewWatchNeed() {
  const nav = useNavigate();
  const [dogId, setDogId] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const [dogs] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("dogs").getFullList({ filter: `owner = "${userId}"` });
    }
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    if (!dogId()) {
      setError("Select a dog");
      return;
    }
    const start = new Date(startDate());
    const end = new Date(endDate());
    if (end < start) {
      setError("End date must be after start date");
      return;
    }
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      await pb.collection("watch_needs").create({
        user: userId,
        dog: dogId(),
        start_date: startDate(),
        end_date: endDate(),
        notes: notes() || undefined,
      });
      nav("/app/matches");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <h1>Add watch need</h1>
      <p>When do you need someone to watch your dog?</p>
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="dog">Dog *</label>
          <select id="dog" value={dogId()} onInput={(e) => setDogId(e.currentTarget.value)} required>
            <option value="">Select a dog</option>
            <Show when={dogs()}>
              <For each={dogs()}>
                {(d) => <option value={d.id}>{d.name}</option>}
              </For>
            </Show>
          </select>
        </div>
        <div class="form-group">
          <label for="startDate">Start date *</label>
          <input id="startDate" type="date" value={startDate()} onInput={(e) => setStartDate(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <label for="endDate">End date *</label>
          <input id="endDate" type="date" value={endDate()} onInput={(e) => setEndDate(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>{loading() ? "Adding..." : "Add"}</button>
        <A href="/app" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</A>
      </form>
    </div>
    </AppShell>
  );
}
