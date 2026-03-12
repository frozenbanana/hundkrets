import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";
import { DogImage } from "~/components/DogImage";
import { DogInfo } from "~/components/DogInfo";

export default function EditWatchNeed() {
  const params = useParams();
  const nav = useNavigate();
  const id = () => params.id;

  const [selectedDogs, setSelectedDogs] = createSignal<string[]>([]);
  const [flexible, setFlexible] = createSignal(true);
  const [openAnyDuration, setOpenAnyDuration] = createSignal(true);
  const [durationSpecific, setDurationSpecific] = createSignal("");
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const [need] = createResource(
    () => id(),
    async (needId) => {
      return pb.collection("watch_needs").getOne(needId);
    }
  );

  const [dogs] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("dogs").getFullList({ filter: `owner = "${userId}"` });
    }
  );

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  createEffect(() => {
    const n = need();
    if (n) {
      // Handle dog as either single ID or array of IDs
      const dogIds = Array.isArray(n.dog) ? n.dog : n.dog ? [n.dog] : [];
      setSelectedDogs(dogIds);
      setFlexible(n.flexible_dates ?? true);
      setOpenAnyDuration(n.open_any_duration ?? true);
      setDurationSpecific(n.duration_specific ?? "");
      setStartDate(n.start_date ?? "");
      setEndDate(n.end_date ?? "");
      setNotes(n.notes ?? "");
    }
  });

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
      const data: Record<string, unknown> = {
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
      await pb.collection("watch_needs").update(id()!, data);
      showToast("Behov sparad");
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
          <h1>Redigera behov</h1>
          <p style="color: var(--color-text-muted);">
            När behöver du hundpassning? Exakta tider bestäms privat med matchningen.
          </p>
        </div>
        <Show when={need.loading}>
          <p style="color: var(--color-text-muted);">Laddar...</p>
        </Show>
        <Show when={need.error}>
          <p style="color: #dc2626;">{need.error?.message}</p>
          <A href="/app/needs" class="btn btn-secondary">Tillbaka</A>
        </Show>
        <Show when={need()}>
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
              <button type="submit" class="btn" disabled={loading()}>
                {loading() ? "Sparar..." : "Spara"}
              </button>
              <A href="/app/needs" class="btn btn-secondary" style="margin-left: 0.5rem;">Avbryt</A>
            </form>
          </div>
        </Show>
      </div>
    </AppShell>
  );
}
