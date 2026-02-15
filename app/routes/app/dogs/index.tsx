import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

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

  return (
    <AppShell>
    <div class="container">
      <h1>My Dogs</h1>
      <p>Add dogs you want to have watched when you travel.</p>
      <A href="/app/dogs/new" class="btn">Add dog</A>
      <Show when={dogs.loading}>
        <p>Loading...</p>
      </Show>
      <Show when={dogs.error}>
        <p style="color: #dc2626;">{dogs.error?.message}</p>
      </Show>
      <Show when={dogs() && dogs()!.length === 0}>
        <p>No dogs yet. Add one to get started.</p>
      </Show>
      <Show when={dogs() && dogs()!.length > 0}>
        <div style="margin-top: 1rem;">
          <For each={dogs()}>
            {(dog) => (
              <div class="card">
                <h3>{dog.name}</h3>
                <p>{dog.breed || "—"} • {dog.size} • {dog.gender}</p>
                {dog.temperament && <p>{dog.temperament}</p>}
                <A href={`/app/dogs/edit/${dog.id}`} class="btn btn-secondary" style="margin-right: 0.5rem;">Edit</A>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
    </AppShell>
  );
}
