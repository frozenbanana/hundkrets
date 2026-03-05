import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";

export default function EditWatchCapacity() {
  const params = useParams();
  const nav = useNavigate();
  const id = () => params.id;

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

  const [capacity] = createResource(
    () => id(),
    async (capId) => {
      return pb.collection("watch_capacity").getOne(capId);
    }
  );

  createEffect(() => {
    const c = capacity();
    if (c) {
      setFlexible(c.flexible_dates ?? true);
      setOpenAnyDuration(c.open_any_duration ?? true);
      setDurationSpecific(c.duration_specific ?? "");
      setStartDate(c.start_date ?? "");
      setEndDate(c.end_date ?? "");
      const sizes = c.dog_sizes;
      setDogSizes(Array.isArray(sizes) ? [...sizes] : sizes ? [sizes] : []);
      setDogGenders((c.dog_genders as "male" | "female" | "any") ?? "any");
      setMaxDogs(c.max_dogs ?? 1);
      setNotes(c.notes ?? "");
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
    if (dogSizes().length === 0) {
      setError("Välj minst en hundstorlek");
      return;
    }
    setLoading(true);
    try {
      const data: Record<string, unknown> = {
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
      await pb.collection("watch_capacity").update(id()!, data);
      showToast("Kapacitet sparad");
      nav("/app/capacity");
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
          <h1>Redigera kapacitet</h1>
          <p style="color: var(--color-text-muted);">
            När kan du passa andras hundar? Exakta tider bestäms privat med matchningen.
          </p>
        </div>
        <Show when={capacity.loading}>
          <p style="color: var(--color-text-muted);">Laddar...</p>
        </Show>
        <Show when={capacity.error}>
          <p style="color: #dc2626;">{capacity.error?.message}</p>
          <A href="/app/capacity" class="btn btn-secondary">Tillbaka</A>
        </Show>
        <Show when={capacity()}>
          <div class="card">
            <form onSubmit={handleSubmit}>
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
                <label for="maxDogs">Max antal hundar</label>
                <input id="maxDogs" type="number" min="1" value={maxDogs()} onInput={(e) => setMaxDogs(parseInt(e.currentTarget.value) || 1)} />
              </div>
              <div class="form-group">
                <label for="notes">Anteckningar</label>
                <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
              </div>
              {error() && <p class="form-error" role="alert">{error()}</p>}
              <button type="submit" class="btn" disabled={loading()}>
                {loading() ? "Sparar..." : "Spara"}
              </button>
              <A href="/app/capacity" class="btn btn-secondary" style="margin-left: 0.5rem;">Avbryt</A>
            </form>
          </div>
        </Show>
      </div>
    </AppShell>
  );
}
