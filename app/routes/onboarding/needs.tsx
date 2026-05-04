import { useNavigate } from "@solidjs/router";
import { showToast } from "~/lib/toast";
import { createEffect, createResource, createSignal, For, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isReceiverOnly, isSitterOnly } from "~/lib/onboarding";
import { parseApiError } from "~/lib/errors";
import { OnboardingShell } from "~/components/OnboardingShell";
import { DogImage } from "~/components/DogImage";
import { DogInfo } from "~/components/DogInfo";

export default function OnboardingNeeds() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
    if (done) {
      nav("/app/explore", { replace: true });
      return;
    }
    if (isSitterOnly()) {
      nav("/onboarding/capacity", { replace: true });
      return;
    }
  });
  const [selectedDogs, setSelectedDogs] = createSignal<string[]>([]);
  const [flexible, setFlexible] = createSignal(true);
  const [openAnyDuration, setOpenAnyDuration] = createSignal(true);
  const [durationSpecific, setDurationSpecific] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [careType, setCareType] = createSignal<"daytime" | "overnight" | "both">("both");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const [dogs] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("dogs").getFullList({ filter: `owner = "${userId}"` });
    }
  );

  createEffect(() => {
    const list = dogs();
    if (list && list.length > 0 && selectedDogs().length === 0) {
      // Select all dogs by default
      setSelectedDogs(list.map((d) => d.id));
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    if (!flexible() && (!startDate() || !endDate())) {
      setError("Ange datum eller välj flexibel");
      return;
    }
    if (!flexible()) {
      const start = new Date(startDate());
      const end = new Date(endDate());
      if (end < start) {
        setError("Slutdatum måste vara efter startdatum");
        return;
      }
    }
    if (dogs()?.length && selectedDogs().length === 0) {
      setError("Välj minst en hund");
      return;
    }
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      const data: Record<string, unknown> = {
        user: userId,
        care_type: careType(),
        flexible_dates: flexible(),
        open_any_duration: openAnyDuration(),
        duration_specific: durationSpecific() || undefined,
        notes: notes() || undefined,
      };
      if (selectedDogs().length > 0) {
        data.dog = selectedDogs().length === 1 ? selectedDogs()[0] : selectedDogs();
      }
      if (!flexible()) {
        data.start_date = startDate();
        data.end_date = endDate();
      }
      await pb.collection("watch_needs").create(data);
      if (isReceiverOnly()) {
        showToast("Behov tillagt");
        nav("/onboarding/recommendations");
      } else {
        showToast("Behov tillagt");
        nav("/onboarding/capacity");
      }
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    if (isReceiverOnly()) {
      nav("/app/explore");
    } else {
      nav("/onboarding/capacity");
    }
  }

  const hasDogs = () => dogs() && dogs()!.length > 0;

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  return (
    <OnboardingShell step={3} totalSteps={isReceiverOnly() ? 4 : 5} title="När du behöver hundpassning" nextStepHint={isReceiverOnly() ? "Nästa: Dina rekommendationer" : "Nästa: När du kan passa hundar"} backHref="/onboarding/dogs">
      <div class="card">
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          När behöver du att någon passar din hund? Du kan vara flexibel—exakta tider bestäms privat.
        </p>
        <Show when={!hasDogs()}>
          <p style="margin-bottom: 1rem;">Du har inte lagt till några hundar än. Lägg till hundar i föregående steg, eller hoppa över för att fortsätta.</p>
          <button type="button" class="btn btn-secondary" onClick={handleSkip}>Skippa</button>
        </Show>
        <Show when={hasDogs()}>
        <form onSubmit={handleSubmit}>
          {error() && <p class="form-error" role="alert" style="margin-bottom: 1rem;">{error()}</p>}
          <Show when={dogs() && dogs()!.length > 0}>
            <div class="form-group">
              <label>Vilka hundar? *</label>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
                <For each={dogs()}>
                  {(d) => (
                    <label class="dog-card" style="cursor: pointer; display: flex; align-items: center; gap: 0.75rem;">
                      <input
                        type="checkbox"
                        checked={selectedDogs().includes(d.id)}
                        onChange={(e) => {
                          if (e.currentTarget.checked) {
                            setSelectedDogs([...selectedDogs(), d.id]);
                          } else {
                            setSelectedDogs(selectedDogs().filter((id) => id !== d.id));
                          }
                        }}
                        style="flex-shrink: 0;"
                      />
                      <DogImage dog={d} baseUrl={baseUrl} class="dog-card-img" style="width: 48px; height: 48px; flex-shrink: 0;" />
                      <div style="flex: 1; min-width: 0;">
                        <DogInfo name={d.name} age={d.age} breed={d.breed} gender={d.gender} />
                      </div>
                    </label>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <div class="flexible-toggle" onClick={() => setFlexible(!flexible())}>
            <input
              type="checkbox"
              id="flexible"
              checked={flexible()}
              onInput={(e) => setFlexible(e.currentTarget.checked)}
            />
            <label for="flexible">{flexible() ? "Datum: Flexibel" : "Datum: Specifik"}</label>
          </div>
          <Show when={!flexible()}>
            <div class="form-group">
              <label for="startDate">Startdatum</label>
              <input id="startDate" type="date" value={startDate()} onInput={(e) => setStartDate(e.currentTarget.value)} />
            </div>
            <div class="form-group">
              <label for="endDate">Slutdatum</label>
              <input id="endDate" type="date" value={endDate()} onInput={(e) => setEndDate(e.currentTarget.value)} />
            </div>
          </Show>
          <div class="flexible-toggle" onClick={() => setOpenAnyDuration(!openAnyDuration())}>
            <input
              type="checkbox"
              id="openAnyDuration"
              checked={openAnyDuration()}
              onInput={(e) => setOpenAnyDuration(e.currentTarget.checked)}
            />
            <label for="openAnyDuration">{openAnyDuration() ? "Tid: Flexibel" : "Tid: Specifik"}</label>
          </div>
          <Show when={!openAnyDuration()}>
            <div class="form-group">
              <label for="durationSpecific">Beskriv exakt vad du behöver</label>
              <textarea
                id="durationSpecific"
                value={durationSpecific()}
                onInput={(e) => setDurationSpecific(e.currentTarget.value)}
                placeholder="T.ex. under lunch på onsdagar, eller vardagsmorgnar"
              />
            </div>
          </Show>
          <div class="form-group">
            <label for="careType">Typ av passning</label>
            <select
              id="careType"
              value={careType()}
              onInput={(e) => setCareType(e.currentTarget.value as "daytime" | "overnight" | "both")}
            >
              <option value="daytime">Dagpassning</option>
              <option value="overnight">Övernattning</option>
              <option value="both">Heldagar (med övernattning)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="notes">Anteckningar</label>
            <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="Några speciella behov?" />
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button type="submit" class="btn" disabled={loading()} data-umami-event="Onboarding needs submit">
            {loading() ? "Sparar..." : "Spara och fortsätt"}
          </button>
            <button type="button" class="btn btn-secondary" onClick={handleSkip}>
              Skippa
            </button>
          </div>
        </form>
        </Show>
      </div>
    </OnboardingShell>
  );
}
