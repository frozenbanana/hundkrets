import { useNavigate } from "@solidjs/router";
import { showToast } from "~/lib/toast";
import { createSignal, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isReceiverOnly, isSitterOnly, clearOnboardingUserType } from "~/lib/onboarding";
import { parseApiError } from "~/lib/errors";
import { OnboardingShell } from "~/components/OnboardingShell";

export default function OnboardingCapacity() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
    if (done) {
      nav("/app/matches", { replace: true });
      return;
    }
    if (isReceiverOnly()) {
      nav("/onboarding/needs", { replace: true });
      return;
    }
  });
  const [flexible, setFlexible] = createSignal(true);
  const [openAnyDuration, setOpenAnyDuration] = createSignal(true);
  const [durationSpecific, setDurationSpecific] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [dogSizes, setDogSizes] = createSignal<("small" | "medium" | "large")[]>(["small", "medium", "large"]);
  const [dogGenders, setDogGenders] = createSignal<"male" | "female" | "any">("any");
  const [maxDogs, setMaxDogs] = createSignal(1);
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

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
    if (dogSizes().length === 0) {
      setError("Välj minst en hundstorlek");
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
      await setOnboardingComplete();
      showToast("Klart! Du kan nu se dina matchningar.");
      nav("/app/matches");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await setOnboardingComplete();
    nav("/app/matches");
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

  return (
    <OnboardingShell step={isSitterOnly() ? 2 : 4} totalSteps={isSitterOnly() ? 2 : 4} title="När du kan passa hundar" nextStepHint="Nästa: Se matchningar" backHref={isSitterOnly() ? "/onboarding/choice" : "/onboarding/needs"}>
      <div class="card">
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          När kan du passa andras hundar? Var flexibel—exakta tider bestäms privat.
        </p>
        <form onSubmit={handleSubmit}>
          {error() && <p class="form-error" role="alert" style="margin-bottom: 1rem;">{error()}</p>}
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
                <label for="durationSpecific">Beskriv exakt när du kan hjälpa till</label>
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
            <label>Hundstorlekar du kan passa (välj alla som passar)</label>
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
                  {size === "small" ? "Liten" : size === "medium" ? "Mellan" : "Stor"}
                </label>
              ))}
            </div>
          </div>
          <div class="form-group">
            <label for="dogGenders">Hundkön</label>
            <select id="dogGenders" value={dogGenders()} onInput={(e) => setDogGenders(e.currentTarget.value as "male" | "female" | "any")}>
              <option value="male">Endast hane</option>
              <option value="female">Endast tik</option>
              <option value="any">Valfritt</option>
            </select>
          </div>
          <div class="form-group">
            <label for="maxDogs">Max antal hundar samtidigt</label>
            <input id="maxDogs" type="number" min="1" value={maxDogs()} onInput={(e) => setMaxDogs(parseInt(e.currentTarget.value) || 1)} />
          </div>
          <div class="form-group">
            <label for="notes">Anteckningar</label>
            <textarea
              id="notes"
              value={notes()}
              onInput={(e) => setNotes(e.currentTarget.value)}
              placeholder="T.ex. Jag är väldigt flexibel, kan ta alla hundar. Hör av dig."
            />
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
      </div>
    </OnboardingShell>
  );
}
