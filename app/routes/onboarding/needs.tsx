import { useNavigate } from "@solidjs/router";
import { showToast } from "~/lib/toast";
import { createEffect, createResource, createSignal, For, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { clearOnboardingUserType, isReceiverOnly, isSitterOnly } from "~/lib/onboarding";
import { parseApiError } from "~/lib/errors";
import { OnboardingShell } from "~/components/OnboardingShell";

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

  createEffect(() => {
    const list = dogs();
    if (list && list.length > 0 && !dogId()) {
      setDogId(list[0].id);
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
    if (dogs()?.length && !dogId()) {
      setError("Välj en hund");
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
      if (isReceiverOnly()) {
        await setOnboardingComplete();
        showToast("Klart! Du kan nu se dina matchningar.");
        nav("/app/explore");
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
      await setOnboardingComplete();
      showToast("Klart! Du kan nu se dina matchningar.");
      nav("/app/explore");
    } else {
      nav("/onboarding/capacity");
    }
  }

  async function setOnboardingComplete() {
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    await pb.collection("users").update(userId, { onboarding_complete: true });
    pb.authStore.save(pb.authStore.token!, {
      ...pb.authStore.model,
      onboarding_complete: true,
    });
    clearOnboardingUserType();
  }

  const hasDogs = () => dogs() && dogs()!.length > 0;

  return (
    <OnboardingShell step={3} totalSteps={isReceiverOnly() ? 3 : 4} title="När du behöver hundpassning" nextStepHint={isReceiverOnly() ? "Nästa: Se matchningar" : "Nästa: När du kan passa hundar"} backHref="/onboarding/dogs">
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
              <label for="dog">Vilken hund? *</label>
              <select id="dog" value={dogId()} onInput={(e) => setDogId(e.currentTarget.value)}>
                <option value="">Välj hund</option>
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
            <label for="flexible">Flexibel—öppen när som helst</label>
          </div>
          <Show when={flexible()}>
            <div class="flexible-toggle" onClick={() => setOpenAnyDuration(!openAnyDuration())}>
              <input
                type="checkbox"
                id="openAnyDuration"
                checked={openAnyDuration()}
                onInput={(e) => setOpenAnyDuration(e.currentTarget.checked)}
              />
              <label for="openAnyDuration">Öppen för valfri längd</label>
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
          </Show>
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
          <div class="form-group">
            <label for="notes">Anteckningar</label>
            <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="Några speciella behov?" />
          </div>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button type="submit" class="btn" disabled={loading()}>
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
