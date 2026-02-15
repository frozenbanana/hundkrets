import { A } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { findMatches } from "~/lib/matching";
import { AppShell } from "~/components/AppShell";

export default function Matches() {
  const [data] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return null;
      const [needs, capacities, users, dogs] = await Promise.all([
        pb.collection("watch_needs").getFullList(),
        pb.collection("watch_capacity").getFullList(),
        pb.collection("users").getFullList(),
        pb.collection("dogs").getFullList(),
      ]);
      const matches = findMatches(
        needs as Parameters<typeof findMatches>[0],
        capacities as Parameters<typeof findMatches>[1],
        userId,
        users as Parameters<typeof findMatches>[4],
        dogs as Parameters<typeof findMatches>[5]
      );
      return { matches, needs, capacities };
    }
  );

  return (
    <AppShell>
    <div class="container">
      <h1>Matches</h1>
      <p>People in your area with complementary schedules. Reach out by phone to arrange the swap.</p>
      <Show when={!pb.authStore.model?.area}>
        <p style="color: #dc2626;">
          <A href="/app/profile">Set your area</A> in your profile to see matches.
        </p>
      </Show>
      <Show when={data.loading}>
        <p>Loading matches...</p>
      </Show>
      <Show when={data.error}>
        <p style="color: #dc2626;">{data.error?.message}</p>
      </Show>
      <Show when={data()?.matches.length === 0 && !data.loading && pb.authStore.model?.area}>
        <p>No matches yet. Add your watch needs and capacity, and make sure your area is set.</p>
        <A href="/app/needs/new" class="btn">Add watch need</A>
        <A href="/app/capacity/new" class="btn btn-secondary" style="margin-left: 0.5rem;">Add watch capacity</A>
      </Show>
      <Show when={data()?.matches && data()!.matches.length > 0}>
        <div style="margin-top: 1rem;">
          <For each={data()!.matches}>
            {(m) => (
              <div class="card">
                <h3>{m.user.name || "Unknown"}</h3>
                {m.user.phone && (
                  <p><strong>Phone:</strong> <a href={`tel:${m.user.phone}`}>{m.user.phone}</a></p>
                )}
                <p><strong>Swap:</strong> You watch their dog when they travel, they watch yours when you travel.</p>
                <p>
                  <strong>Their dog:</strong> {m.theirDog?.name ?? "—"} ({m.theirNeed.start_date} – {m.theirNeed.end_date}) •{" "}
                  <strong>Your dog:</strong> {m.myDog?.name ?? "—"} ({m.myNeed.start_date} – {m.myNeed.end_date})
                </p>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
    </AppShell>
  );
}
