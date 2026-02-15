import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

export default function EditDog() {
  const params = useParams();
  const nav = useNavigate();

  const [dog] = createResource(
    () => params.id,
    async (id) => pb.collection("dogs").getOne(id)
  );

  const [name, setName] = createSignal("");
  const [breed, setBreed] = createSignal("");
  const [size, setSize] = createSignal<"small" | "medium" | "large">("medium");
  const [gender, setGender] = createSignal<"male" | "female">("male");
  const [temperament, setTemperament] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    const d = dog();
    if (d) {
      setName(d.name);
      setBreed(d.breed ?? "");
      setSize(d.size);
      setGender(d.gender);
      setTemperament(d.temperament ?? "");
      setNotes(d.notes ?? "");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await pb.collection("dogs").update(params.id, {
        name: name(),
        breed: breed() || undefined,
        size: size(),
        gender: gender(),
        temperament: temperament() || undefined,
        notes: notes() || undefined,
      });
      nav("/app/dogs");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <h1>Edit dog</h1>
      <Show when={dog.loading}>
        <p>Loading...</p>
      </Show>
      <Show when={dog.error}>
        <p style="color: #dc2626;">{dog.error?.message}</p>
      </Show>
      <Show when={dog()}>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name">Name *</label>
            <input id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
          </div>
          <div class="form-group">
            <label for="breed">Breed</label>
            <input id="breed" type="text" value={breed()} onInput={(e) => setBreed(e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label for="size">Size *</label>
            <select id="size" value={size()} onInput={(e) => setSize(e.currentTarget.value as "small" | "medium" | "large")}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div class="form-group">
            <label for="gender">Gender *</label>
            <select id="gender" value={gender()} onInput={(e) => setGender(e.currentTarget.value as "male" | "female")}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div class="form-group">
            <label for="temperament">Temperament</label>
            <input id="temperament" type="text" value={temperament()} onInput={(e) => setTemperament(e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label for="notes">Notes</label>
            <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
          </div>
          {error() && <p style="color: #dc2626;">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()}>{loading() ? "Saving..." : "Save"}</button>
          <A href="/app/dogs" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</A>
        </form>
      </Show>
    </div>
    </AppShell>
  );
}
