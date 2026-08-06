import { useNavigate } from "@solidjs/router";
import { showToast } from "~/lib/toast";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isOnboardingDone, isReceiverOnly, isSitterOnly } from "~/lib/onboarding";
import { parseApiError } from "~/lib/errors";
import { DogImage } from "~/components/DogImage";
import { DogInfo } from "~/components/DogInfo";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";
import { VideoCaptureInput } from "~/components/VideoCaptureInput";
import { saveMediaRecord, uploadToR2 } from "~/lib/media";
import { ValidatedInput } from "~/components/ValidatedInput";
import { OnboardingShell } from "~/components/OnboardingShell";

export default function OnboardingDogs() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    if (isOnboardingDone(m)) {
      nav("/app/explore", { replace: true });
      return;
    }
    if (isSitterOnly()) {
      nav("/onboarding/capacity", { replace: true });
      return;
    }
  });
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

  const [dogs, { refetch }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("dogs").getFullList({ filter: `owner = "${userId}"` });
    }
  );

  async function handleSaveAndContinue() {
    if (!name().trim()) {
      nav("/onboarding/needs");
      return;
    }
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
        notes: notes() || undefined,
      };
      const file = imageFile();
      if (file) {
        const uploaded = await uploadToR2(file, { kind: "image", contentType: file.type || "image/jpeg" });
        data.image_key = uploaded.objectKey;
        await saveMediaRecord({ objectKey: uploaded.objectKey, kind: "image" }).catch(() => {});
      }
      await pb.collection("dogs").create(data);
      showToast("Hund tillagd");
      nav("/onboarding/needs");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDog(e: Event) {
    e.preventDefault();
    if (!name().trim()) return;
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
        notes: notes() || undefined,
      };
      const file = imageFile();
      if (file) {
        const uploaded = await uploadToR2(file, { kind: "image", contentType: file.type || "image/jpeg" });
        data.image_key = uploaded.objectKey;
        await saveMediaRecord({ objectKey: uploaded.objectKey, kind: "image" }).catch(() => {});
      }
      await pb.collection("dogs").create(data);
      setName("");
      setBreed("");
      setSize("medium");
      setGender("male");
      setAge("");
      setTemperamentNewPeople("");
      setTemperamentNewDogsFemale("");
      setTemperamentNewDogsMale("");
      setNotes("");
      setImageFile(null);
      refetch();
      showToast("Hund tillagd");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  return (
    <OnboardingShell step={2} totalSteps={isReceiverOnly() ? 4 : 5} title="Dina hundar" nextStepHint="Nästa: När du behöver hundpassning" backHref="/onboarding/choice">
      <div class="card">
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          Lägg till hundar om du har (valfritt). Du kan lägga till fler senare från översikten.
        </p>
        <form onSubmit={handleAddDog}>
          {error() && <p class="form-error" role="alert" style="margin-bottom: 1rem;">{error()}</p>}
          <div class="form-group">
            <label for="name">Hundens namn *</label>
            <ValidatedInput id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} validation="required" required placeholder="T.ex. Bella" />
          </div>
          <ImageCaptureInput
            id="image"
            label="Foto (valfritt)"
            value={imageFile()}
            onInput={setImageFile}
            previewShape="rect"
            hint="På mobil: ta foto eller välj från galleri. På dator: dra och släpp eller klicka för att välja."
            dropHint="Släpp bilden här"
          />
          <div class="form-group" style="margin-top: 1rem;">
            <label>Kort video (valfritt, max 15 s)</label>
            <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0 0 0.5rem;">
              Visa din hund i rörelse — du kan hoppa över och ladda upp senare.
            </p>
            <VideoCaptureInput compact />
          </div>
          <div class="form-group">
            <label for="breed">Ras</label>
            <input id="breed" type="text" value={breed()} onInput={(e) => setBreed(e.currentTarget.value)} placeholder="T.ex. Labrador"/>
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
            <label for="notes">Anteckningar (valfritt)</label>
            <textarea id="notes" value={notes()} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="T.ex. speciella behov, diet, mediciner" rows={4} />
          </div>
        <button type="submit" class="btn" disabled={loading()} data-umami-event="Onboarding dogs submit">
          {loading() ? "Sparar..." : "Spara och fortsätt"}
        </button>
        </form>
        <Show when={dogs() && dogs()!.length > 0}>
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-fur);">
            <h3>Dina hundar</h3>
            <p style="font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: 0.75rem;">Lägg till fler hundar nedan om du vill.</p>
            <For each={dogs()}>
              {(dog) => (
                <div class="dog-card" style="margin-bottom: 0.75rem;">
                  <DogImage dog={dog} baseUrl={baseUrl} class="dog-card-img" />
                  <div>
                    <DogInfo name={dog.name} age={dog.age} breed={dog.breed} gender={dog.gender} />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" class="btn" disabled={loading()} onClick={() => handleSaveAndContinue()}>
            {loading() ? "Sparar..." : "Spara och fortsätt"}
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => nav("/onboarding/needs")} data-umami-event="Onboarding dogs skip">
            Skippa
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
