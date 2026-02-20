import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";

export default function EditWatchNeed() {
  const params = useParams();
  const nav = useNavigate();
  const id = () => params.id;

  const [dogId, setDogId] = createSignal("");
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

  createEffect(() => {
    const n = need();
    if (n) {
      setDogId(n.dog ?? "");
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
    if (!dogId()) {
      setError("Välj en hund");
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
      await pb.collection("watch_needs").update(id()!, data);
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
          <span class="paw-emoji">🐕</span>
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
                <label for="dog">Hund *</label>
                <select id="dog" value={dogId()} onInput={(e) => setDogId(e.currentTarget.value)} required>
                  <option value="">Välj hund</option>
                  <Show when={dogs()}>
                    <For each={dogs()}>
                      {(d) => <option value={d.id}>{d.name}</option>}
                    </For>
                  </Show>
                </select>
              </div>
              <div class="flexible-toggle" onClick={() => setFlexible(!flexible())}>
                <input type="checkbox" id="flexible" checked={flexible()} onInput={(e) => setFlexible(e.currentTarget.checked)} />
                <label for="flexible">Flexibel—öppen när som helst</label>
              </div>
              <Show when={flexible()}>
                <div class="flexible-toggle" onClick={() => setOpenAnyDuration(!openAnyDuration())}>
                  <input type="checkbox" id="openAnyDuration" checked={openAnyDuration()} onInput={(e) => setOpenAnyDuration(e.currentTarget.checked)} />
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
