import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";
import { DogImage } from "~/components/DogImage";
import { DogInfo } from "~/components/DogInfo";

export default function NewWatchNeed() {
  const nav = useNavigate();
  const [selectedDogs, setSelectedDogs] = createSignal<string[]>([]);
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

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    if (selectedDogs().length === 0) {
      setError("Välj minst en hund");
      return;
    }
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
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      const data: Record<string, unknown> = {
        user: userId,
        dog: selectedDogs().length === 1 ? selectedDogs()[0] : selectedDogs(),
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
      showToast("Behov tillagt");
      nav("/app/needs");
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
        <h1>Lägg till behov</h1>
        <p style="color: var(--color-text-muted);">När behöver du hundpassning? Exakta tider bestäms privat med matchningen.</p>
      </div>
      <div class="card">
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label>Hundar *</label>
          <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem;">
            <Show when={dogs()}>
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
            </Show>
          </div>
        </div>
        <div class="flexible-toggle" onClick={() => setFlexible(!flexible())}>
          <input type="checkbox" id="flexible" checked={flexible()} onInput={(e) => setFlexible(e.currentTarget.checked)} />
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
          <input type="checkbox" id="openAnyDuration" checked={openAnyDuration()} onInput={(e) => setOpenAnyDuration(e.currentTarget.checked)} />
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
          <label for="notes">Anteckningar</label>
          <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
        </div>
        {error() && <p class="form-error" role="alert">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>{loading() ? "Lägger till..." : "Lägg till"}</button>
        <A href="/app/needs" class="btn btn-secondary" style="margin-left: 0.5rem;">Avbryt</A>
      </form>
      </div>
    </div>
    </AppShell>
  );
}
