import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";

export default function EditDog() {
  const params = useParams();
  const nav = useNavigate();

  const [dog] = createResource(
    () => params.id,
    async (id) => pb.collection("dogs").getOne(id)
  );

  const TEMPERAMENT_OPTS = [
    { value: "friendly", label: "Vänlig" },
    { value: "cautious", label: "Försiktig" },
    { value: "shy", label: "Blyg" },
    { value: "reactive", label: "Reaktiv" },
    { value: "neutral", label: "Neutral" },
    { value: "unknown", label: "Okänd" },
  ] as const;
  const [name, setName] = createSignal("");
  const [breed, setBreed] = createSignal("");
  const [size, setSize] = createSignal<"small" | "medium" | "large">("medium");
  const [gender, setGender] = createSignal<"male" | "female">("male");
  const [age, setAge] = createSignal<number | "">("");
  const [temperamentNewPeople, setTemperamentNewPeople] = createSignal("");
  const [temperamentNewDogsFemale, setTemperamentNewDogsFemale] = createSignal("");
  const [temperamentNewDogsMale, setTemperamentNewDogsMale] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [imageFile, setImageFile] = createSignal<File | null>(null);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    const d = dog();
    if (d) {
      setName(d.name);
      setBreed(d.breed ?? "");
      setSize(d.size);
      setGender(d.gender);
      setAge(d.age != null ? d.age : "");
      setTemperamentNewPeople(d.temperament_new_people ?? "");
      setTemperamentNewDogsFemale(d.temperament_new_dogs_female ?? "");
      setTemperamentNewDogsMale(d.temperament_new_dogs_male ?? "");
      setNotes(d.notes ?? "");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const file = imageFile();
      if (file) {
        const fd = new FormData();
        fd.append("name", name());
        fd.append("breed", breed());
        fd.append("size", size());
        fd.append("gender", gender());
        if (age() !== "") fd.append("age", String(age()));
        fd.append("temperament_new_people", temperamentNewPeople());
        fd.append("temperament_new_dogs_female", temperamentNewDogsFemale());
        fd.append("temperament_new_dogs_male", temperamentNewDogsMale());
        fd.append("notes", notes());
        fd.append("image", file);
        await pb.collection("dogs").update(params.id, fd);
      } else {
        await pb.collection("dogs").update(params.id, {
          name: name(),
          breed: breed() || undefined,
          size: size(),
          gender: gender(),
          age: age() !== "" ? age() : undefined,
          temperament_new_people: temperamentNewPeople() || undefined,
          temperament_new_dogs_female: temperamentNewDogsFemale() || undefined,
          temperament_new_dogs_male: temperamentNewDogsMale() || undefined,
          notes: notes() || undefined,
        });
      }
      showToast("Hund sparad");
      nav("/app/dogs");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <h1>Redigera hund</h1>
      <Show when={dog.loading}>
        <p style="color: var(--color-text-muted);">Laddar...</p>
      </Show>
      <Show when={dog.error}>
        <p style="color: #dc2626;">{dog.error?.message}</p>
      </Show>
      <Show when={dog()}>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name">Namn *</label>
            <input id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
          </div>
          <ImageCaptureInput
            id="image"
            label="Foto (valfritt)"
            value={imageFile()}
            onInput={setImageFile}
            previewShape="rect"
            existingUrl={
              dog()?.image && dog()?.id
                ? `${import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090"}/api/files/dogs/${dog()!.id}/${dog()!.image}`
                : undefined
            }
            hint="På mobil: ta foto eller välj från galleri. På dator: dra och släpp eller klicka för att välja."
            dropHint="Släpp bild här"
          />
          <div class="form-group">
            <label for="breed">Ras</label>
            <input id="breed" type="text" value={breed()} onInput={(e) => setBreed(e.currentTarget.value)} />
          </div>
          <div class="form-group">
            <label for="size">Storlek *</label>
            <select id="size" value={size()} onInput={(e) => setSize(e.currentTarget.value as "small" | "medium" | "large")}>
              <option value="small">Liten</option>
              <option value="medium">Mellan</option>
              <option value="large">Stor</option>
            </select>
          </div>
          <div class="form-group">
            <label for="gender">Kön *</label>
            <select id="gender" value={gender()} onInput={(e) => setGender(e.currentTarget.value as "male" | "female")}>
              <option value="male">Hane</option>
              <option value="female">Tik</option>
            </select>
          </div>
          <div class="form-group">
            <label for="age">Ålder (år)</label>
            <input id="age" type="number" min={0} max={25} value={age() === "" ? "" : age()} onInput={(e) => { const v = e.currentTarget.value; setAge(v === "" ? "" : parseInt(v, 10)); }} placeholder="T.ex. 3" />
          </div>
          <div class="form-group">
            <label>Temperament i olika situationer</label>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div>
                <label for="temp_people" style="font-weight: 500; font-size: 0.9rem;">Mötande nya människor</label>
                <select id="temp_people" value={temperamentNewPeople()} onInput={(e) => setTemperamentNewPeople(e.currentTarget.value)}>
                  <option value="">—</option>
                  {TEMPERAMENT_OPTS.map((o) => <option value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label for="temp_dogs_f" style="font-weight: 500; font-size: 0.9rem;">Mötande nya hundar (tik)</label>
                <select id="temp_dogs_f" value={temperamentNewDogsFemale()} onInput={(e) => setTemperamentNewDogsFemale(e.currentTarget.value)}>
                  <option value="">—</option>
                  {TEMPERAMENT_OPTS.map((o) => <option value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label for="temp_dogs_m" style="font-weight: 500; font-size: 0.9rem;">Mötande nya hundar (hane)</label>
                <select id="temp_dogs_m" value={temperamentNewDogsMale()} onInput={(e) => setTemperamentNewDogsMale(e.currentTarget.value)}>
                  <option value="">—</option>
                  {TEMPERAMENT_OPTS.map((o) => <option value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label for="notes">Anteckningar</label>
            <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
          </div>
          {error() && <p class="form-error" role="alert">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()}>{loading() ? "Sparar..." : "Spara"}</button>
          <A href="/app/dogs" class="btn btn-secondary" style="margin-left: 0.5rem;">Avbryt</A>
        </form>
      </Show>
    </div>
    </AppShell>
  );
}
