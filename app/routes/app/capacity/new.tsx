import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

export default function NewWatchCapacity() {
  const nav = useNavigate();
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [dogSizes, setDogSizes] = createSignal<"small" | "medium" | "large" | "any">("any");
  const [dogGenders, setDogGenders] = createSignal<"male" | "female" | "any">("any");
  const [maxDogs, setMaxDogs] = createSignal(1);
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
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
      await pb.collection("watch_capacity").create({
        user: userId,
        start_date: startDate(),
        end_date: endDate(),
        dog_sizes: dogSizes(),
        dog_genders: dogGenders(),
        max_dogs: maxDogs(),
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
      <h1>Add watch capacity</h1>
      <p>When can you watch someone else's dog? What size and gender can you handle?</p>
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="startDate">Start date *</label>
          <input id="startDate" type="date" value={startDate()} onInput={(e) => setStartDate(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <label for="endDate">End date *</label>
          <input id="endDate" type="date" value={endDate()} onInput={(e) => setEndDate(e.currentTarget.value)} required />
        </div>
        <div class="form-group">
          <label for="dogSizes">Dog sizes you can watch</label>
          <select id="dogSizes" value={dogSizes()} onInput={(e) => setDogSizes(e.currentTarget.value as "small" | "medium" | "large" | "any")}>
            <option value="small">Small only</option>
            <option value="medium">Medium only</option>
            <option value="large">Large only</option>
            <option value="any">Any size</option>
          </select>
        </div>
        <div class="form-group">
          <label for="dogGenders">Dog genders you can watch</label>
          <select id="dogGenders" value={dogGenders()} onInput={(e) => setDogGenders(e.currentTarget.value as "male" | "female" | "any")}>
            <option value="male">Male only</option>
            <option value="female">Female only</option>
            <option value="any">Any</option>
          </select>
        </div>
        <div class="form-group">
          <label for="maxDogs">Max dogs</label>
          <input id="maxDogs" type="number" min="1" value={maxDogs()} onInput={(e) => setMaxDogs(parseInt(e.currentTarget.value) || 1)} />
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
