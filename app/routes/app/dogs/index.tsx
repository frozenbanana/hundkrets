import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";
import { DogImage } from "~/components/DogImage";

export default function DogsList() {
  const nav = useNavigate();

  const [dogs] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      const list = await pb.collection("dogs").getFullList({
        filter: `owner = "${userId}"`,
      });
      return list;
    }
  );

  const userId = () => pb.authStore.model?.id;
  if (!userId()) {
    nav("/login", { replace: true });
    return null;
  }

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">🐕</span>
        <h1>Mina hundar</h1>
        <p style="color: var(--color-text-muted);">Lägg till hundar du vill ha passade när du reser.</p>
      </div>
      <A href="/app/dogs/new" class="btn">Lägg till hund</A>
      <Show when={dogs.loading}>
        <p style="color: var(--color-text-muted);">Laddar...</p>
      </Show>
      <Show when={dogs.error}>
        <p style="color: #dc2626;">{dogs.error?.message}</p>
      </Show>
      <Show when={dogs() && dogs()!.length === 0}>
        <p style="color: var(--color-text-muted);">Inga hundar ännu. Lägg till en för att komma igång.</p>
      </Show>
      <Show when={dogs() && dogs()!.length > 0}>
        <div style="margin-top: 1rem;">
          <For each={dogs()}>
            {(dog) => (
              <div class="card">
                <div class="dog-card">
                  <DogImage dog={dog} baseUrl={baseUrl} class="dog-card-img" />
                  <div>
                    <h3>{dog.name}</h3>
                    <p>{dog.breed || "—"} • {dog.size} • {dog.gender}</p>
                    {(dog.temperament_new_people || dog.temperament_new_dogs_female || dog.temperament_new_dogs_male) && (
                      <p style="font-size: 0.9rem; color: var(--color-text-muted);">
                        Nya människor: {dog.temperament_new_people || "—"} • Nya hundar (Hona): {dog.temperament_new_dogs_female || "—"} • Nya hundar (Hane): {dog.temperament_new_dogs_male || "—"}
                      </p>
                    )}
                    <A href={`/app/dogs/edit/${dog.id}`} class="btn btn-secondary" style="margin-right: 0.5rem;">Redigera</A>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
    </AppShell>
  );
}
