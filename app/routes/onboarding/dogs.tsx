import { A, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { DogImage } from "~/components/DogImage";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";
import { OnboardingShell } from "~/components/OnboardingShell";

export default function OnboardingDogs() {
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
  });
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
  const [imageFile, setImageFile] = createSignal<File | null>(null);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const [dogs] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("dogs").getFullList({ filter: `owner = "${userId}"` });
    }
  );

  async function handleAddDog(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");
      const data: Record<string, unknown> = {
        owner: userId,
        name: name(),
        breed: breed() || undefined,
        size: size(),
        gender: gender(),
        age: age() !== "" ? age() : undefined,
        temperament_new_people: temperamentNewPeople() || undefined,
        temperament_new_dogs_female: temperamentNewDogsFemale() || undefined,
        temperament_new_dogs_male: temperamentNewDogsMale() || undefined,
      };
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
        fd.append("image", file);
        await pb.collection("dogs").create(fd);
      } else {
        await pb.collection("dogs").create(data);
      }
      setName("");
      setBreed("");
      setSize("medium");
      setGender("male");
      setAge("");
      setTemperamentNewPeople("");
      setTemperamentNewDogsFemale("");
      setTemperamentNewDogsMale("");
      setImageFile(null);
      dogs.refetch();
    } catch (err: unknown) {
      const e = err as { status?: number; data?: { name?: unknown } };
      if (e?.status === 400 && e?.data?.name) {
        setError("Du har redan en hund med det namnet. Välj ett annat.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to add dog");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    nav("/onboarding/needs");
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  return (
    <OnboardingShell step={2} totalSteps={4} title="Your dogs">
      <div class="card">
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          Add at least one dog. You can add more later from your dashboard.
        </p>
        <form onSubmit={handleAddDog}>
          <div class="form-group">
            <label for="name">Dog name *</label>
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
          {error() && <p style="color: #dc2626;">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()}>
            {loading() ? "Adding..." : "Add dog"}
          </button>
        </form>
        <Show when={dogs() && dogs()!.length > 0}>
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-fur);">
            <h3>Your dogs</h3>
            <For each={dogs()}>
              {(dog) => (
                <div class="dog-card" style="margin-bottom: 0.75rem;">
                  <DogImage dog={dog} baseUrl={baseUrl} class="dog-card-img" />
                  <div>
                    <strong>{dog.name}</strong> • {dog.size} • {dog.gender}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem;">
          <button type="button" class="btn" onClick={() => nav("/onboarding/needs")}>
            Continue
          </button>
          <button type="button" class="btn btn-secondary" onClick={handleSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
