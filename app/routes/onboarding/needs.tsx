import { useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { OnboardingShell } from "~/components/OnboardingShell";

export default function OnboardingNeeds() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    if (pb.authStore.model?.area) {
      nav("/app/matches", { replace: true });
      return;
    }
  });
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
    if (dogs()?.length && !dogId()) {
      setError("Select a dog");
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
        notes: notes() || undefined,
      };
      if (dogId()) data.dog = dogId();
      if (!flexible()) {
        data.start_date = startDate();
        data.end_date = endDate();
      }
      await pb.collection("watch_needs").create(data);
      nav("/onboarding/capacity");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    nav("/onboarding/capacity");
  }

  const hasDogs = () => dogs() && dogs()!.length > 0;

  return (
    <OnboardingShell step={3} totalSteps={4} title="When you need dog sitting">
      <div class="card">
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          When do you need someone to watch your dog? You can be flexible—exact times are worked out privately.
        </p>
        <Show when={!hasDogs()}>
          <p style="margin-bottom: 1rem;">You haven't added any dogs yet. Add dogs in the previous step, or skip to continue.</p>
          <button type="button" class="btn" onClick={handleSkip}>Continue</button>
        </Show>
        <Show when={hasDogs()}>
        <form onSubmit={handleSubmit}>
          <Show when={dogs() && dogs()!.length > 0}>
            <div class="form-group">
              <label for="dog">Which dog? *</label>
              <select id="dog" value={dogId()} onInput={(e) => setDogId(e.currentTarget.value)}>
                <option value="">Select a dog</option>
                <For each={dogs()}>
                  {(d) => <option value={d.id}>{d.name}</option>}
                </For>
              </select>
            </div>
          </Show>
          <div class="flexible-toggle" onClick={() => setFlexible(!flexible())}>
            <input
              type="checkbox"
              id="flexible"
              checked={flexible()}
              onInput={(e) => setFlexible(e.currentTarget.checked)}
            />
            <label for="flexible">Flexible—open anytime</label>
          </div>
          <Show when={flexible()}>
            <div class="flexible-toggle" onClick={() => setOpenAnyDuration(!openAnyDuration())}>
              <input
                type="checkbox"
                id="openAnyDuration"
                checked={openAnyDuration()}
                onInput={(e) => setOpenAnyDuration(e.currentTarget.checked)}
              />
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
            <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="Any special needs?" />
          </div>
          {error() && <p style="color: #dc2626;">{error()}</p>}
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button type="submit" class="btn" disabled={loading()}>
              {loading() ? "Saving..." : "Continue"}
            </button>
            <button type="button" class="btn btn-secondary" onClick={handleSkip}>
              Skip for now
            </button>
          </div>
        </form>
        </Show>
      </div>
    </OnboardingShell>
  );
}
