import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";

export default function NewWatchNeed() {
  const nav = useNavigate();
  const [dogId, setDogId] = createSignal("");
  const [flexible, setFlexible] = createSignal(true);
  const [openAnyDuration, setOpenAnyDuration] = createSignal(true);
  const [durationSpecific, setDurationSpecific] = createSignal("");
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
    if (!flexible() && (!startDate() || !endDate())) {
      setError("Enter dates or choose flexible");
      return;
    }
    if (!flexible()) {
      const start = new Date(startDate());
      const end = new Date(endDate());
      if (end < start) {
        setError("End date must be after start date");
        return;
      }
    }
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      const data: Record<string, unknown> = {
        user: userId,
        dog: dogId(),
        flexible_dates: flexible(),
        open_any_duration: openAnyDuration(),
        duration_specific: durationSpecific() || undefined,
        notes: notes() || undefined,
      };
      if (!flexible()) {
        data.start_date = startDate();
        data.end_date = endDate();
      }
      await pb.collection("watch_needs").create(data);
      nav("/app/matches");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Add watch need</h1>
        <p style="color: var(--color-text-muted);">When do you need someone to watch your dog? Exact times can be worked out privately.</p>
      </div>
      <div class="card">
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
        <div class="flexible-toggle" onClick={() => setFlexible(!flexible())}>
          <input type="checkbox" id="flexible" checked={flexible()} onInput={(e) => setFlexible(e.currentTarget.checked)} />
          <label for="flexible">Flexible—open anytime</label>
        </div>
        <Show when={flexible()}>
          <div class="flexible-toggle" onClick={() => setOpenAnyDuration(!openAnyDuration())}>
            <input type="checkbox" id="openAnyDuration" checked={openAnyDuration()} onInput={(e) => setOpenAnyDuration(e.currentTarget.checked)} />
            <label for="openAnyDuration">Open for any duration</label>
          </div>
          <Show when={!openAnyDuration()}>
            <div class="form-group">
              <label for="durationSpecific">Describe exactly what you need</label>
              <textarea
                id="durationSpecific"
                value={durationSpecific()}
                onInput={(e) => setDurationSpecific(e.currentTarget.value)}
                placeholder="e.g. During lunch on Wednesdays, or weekday mornings only"
              />
            </div>
          </Show>
        </Show>
        <Show when={!flexible()}>
          <div class="form-group">
            <label for="startDate">Start date</label>
            <input id="startDate" type="date" value={startDate()} onInput={(e) => setStartDate(e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label for="endDate">End date</label>
            <input id="endDate" type="date" value={endDate()} onInput={(e) => setEndDate(e.currentTarget.value)} />
          </div>
        </Show>
        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>{loading() ? "Adding..." : "Add"}</button>
        <A href="/app" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</A>
      </form>
      </div>
    </div>
    </AppShell>
  );
}
