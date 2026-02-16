import { A, useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";

export default function NewDog() {
  const nav = useNavigate();
  const TEMPERAMENT_OPTS = [
    { value: "friendly", label: "Friendly" },
    { value: "cautious", label: "Cautious" },
    { value: "shy", label: "Shy" },
    { value: "reactive", label: "Reactive" },
    { value: "neutral", label: "Neutral" },
    { value: "unknown", label: "Unknown" },
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

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      const file = imageFile();
      if (file) {
        const fd = new FormData();
        fd.append("owner", userId);
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
        await pb.collection("dogs").create(fd);
      } else {
        await pb.collection("dogs").create({
          owner: userId,
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
      nav("/app/dogs");
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { name?: { message?: string } } };
      if (e?.status === 400 && e?.data?.name) {
        setError("Du har redan en hund med det namnet. Välj ett annat.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to add dog");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Add dog</h1>
      </div>
      <div class="card">
      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label for="name">Name *</label>
          <input id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
        </div>
        <ImageCaptureInput
          id="image"
          label="Photo (optional)"
          capture="environment"
          value={imageFile()}
          onInput={setImageFile}
          previewShape="rect"
          hint="On mobile: tap to take a photo. On desktop: drag & drop or click to choose."
          dropHint="Drop image here"
        />
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
            <label for="age">Ålder (år)</label>
            <input id="age" type="number" min={0} max={25} value={age() === "" ? "" : age()} onInput={(e) => { const v = e.currentTarget.value; setAge(v === "" ? "" : parseInt(v, 10)); }} placeholder="T.ex. 3" />
          </div>
          <div class="form-group">
            <label>Temperament in different settings</label>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div>
              <label for="temp_people" style="font-weight: 500; font-size: 0.9rem;">Meeting new people</label>
              <select id="temp_people" value={temperamentNewPeople()} onInput={(e) => setTemperamentNewPeople(e.currentTarget.value)}>
                <option value="">—</option>
                {TEMPERAMENT_OPTS.map((o) => <option value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label for="temp_dogs_f" style="font-weight: 500; font-size: 0.9rem;">Meeting new dogs (female)</label>
              <select id="temp_dogs_f" value={temperamentNewDogsFemale()} onInput={(e) => setTemperamentNewDogsFemale(e.currentTarget.value)}>
                <option value="">—</option>
                {TEMPERAMENT_OPTS.map((o) => <option value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label for="temp_dogs_m" style="font-weight: 500; font-size: 0.9rem;">Meeting new dogs (male)</label>
              <select id="temp_dogs_m" value={temperamentNewDogsMale()} onInput={(e) => setTemperamentNewDogsMale(e.currentTarget.value)}>
                <option value="">—</option>
                {TEMPERAMENT_OPTS.map((o) => <option value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="notes">Notes (special needs, diet)</label>
          <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>{loading() ? "Adding..." : "Add dog"}</button>
        <A href="/app/dogs" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</A>
      </form>
      </div>
    </div>
    </AppShell>
  );
}
