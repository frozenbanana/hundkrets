import { A, useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";

export default function NewWatchCapacity() {
  const nav = useNavigate();
  const [flexible, setFlexible] = createSignal(true);
  const [openAnyDuration, setOpenAnyDuration] = createSignal(true);
  const [durationSpecific, setDurationSpecific] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [dogSizes, setDogSizes] = createSignal<("small" | "medium" | "large")[]>([]);
  const [dogGenders, setDogGenders] = createSignal<"male" | "female" | "any">("any");
  const [maxDogs, setMaxDogs] = createSignal(1);
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
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
    if (dogSizes().length === 0) {
      setError("Select at least one dog size");
      return;
    }
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      const data: Record<string, unknown> = {
        user: userId,
        flexible_dates: flexible(),
        open_any_duration: openAnyDuration(),
        duration_specific: durationSpecific() || undefined,
        dog_sizes: dogSizes(),
        dog_genders: dogGenders(),
        max_dogs: maxDogs(),
        notes: notes() || undefined,
      };
      if (!flexible()) {
        data.start_date = startDate();
        data.end_date = endDate();
      }
      await pb.collection("watch_capacity").create(data);
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
        <span class="paw-emoji">🏠</span>
        <h1>Add watch capacity</h1>
        <p style="color: var(--color-text-muted);">When can you watch someone else's dog? Exact times can be arranged privately.</p>
      </div>
      <div class="card">
      <form onSubmit={handleSubmit}>
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
              <label for="durationSpecific">Describe exactly when you can help</label>
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
          <label>Dog sizes you can watch (select all that apply)</label>
          <div class="checkbox-group">
            {(["small", "medium", "large"] as const).map((size) => (
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={dogSizes().includes(size)}
                  onInput={(e) => {
                    if (e.currentTarget.checked) {
                      setDogSizes([...dogSizes(), size]);
                    } else {
                      setDogSizes(dogSizes().filter((s) => s !== size));
                    }
                  }}
                />
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </label>
            ))}
          </div>
        </div>
        <div class="form-group">
          <label for="dogGenders">Dog genders</label>
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
    </div>
    </AppShell>
  );
}
