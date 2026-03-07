import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

const sizeLabel: Record<string, string> = { small: "Liten", medium: "Mellan", large: "Stor" };
const genderLabel: Record<string, string> = { male: "Hane", female: "Tik", any: "Valfritt" };

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function dateStr(c: {
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  start_date?: string;
  end_date?: string;
}) {
  if (!c.flexible_dates && c.start_date && c.end_date) {
    return `${formatDate(c.start_date)} – ${formatDate(c.end_date)}`;
  }
  if (c.flexible_dates) {
    if (c.open_any_duration !== false) return "Flexibel, valfri längd";
    return c.duration_specific ? `Flexibel: ${c.duration_specific}` : "Flexibel";
  }
  return "—";
}

function sizesStr(s: string | string[] | undefined): string {
  if (!s) return "—";
  const arr = Array.isArray(s) ? s : [s];
  if (arr.length >= 3) return "Alla storlekar";
  return arr.map((x) => sizeLabel[x] ?? x).join(", ");
}

export default function CapacityList() {
  const nav = useNavigate();

  const [capacities, { refetch }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("watch_capacity").getFullList({
        filter: `user = "${userId}"`,
      });
    }
  );

  if (!pb.authStore.model?.id) {
    nav("/login", { replace: true });
    return null;
  }

  async function handleDelete(id: string) {
    if (!confirm("Är du säker på att du vill ta bort denna kapacitet?")) return;
    try {
      await pb.collection("watch_capacity").delete(id);
      refetch();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <AppShell>
      <div class="container">
        <A href="/app/profile" class="profile-back-link" style="display: inline-block; margin-bottom: 1rem;">← Tillbaka till Min profil</A>
        <div class="page-hero">
          <span class="paw-emoji">🏠</span>
          <h1>Min kapacitet</h1>
          <p style="color: var(--color-text-muted);">
            När kan du passa andras hundar? Exakta tider bestäms privat med matchningen.
          </p>
        </div>
        <Show when={capacities.loading}>
          <p style="color: var(--color-text-muted);">Laddar...</p>
        </Show>
        <Show when={capacities.error}>
          <p style="color: #dc2626;">{capacities.error?.message}</p>
        </Show>
        <Show when={capacities() && capacities()!.length === 0}>
          <div class="card">
            <p style="color: var(--color-text-muted);">Ingen kapacitet ännu. Lägg till när du kan passa hundar.</p>
            <A href="/app/capacity/new" class="btn" style="margin-top: 1rem;">Lägg till kapacitet</A>
          </div>
        </Show>
        <Show when={capacities() && capacities()!.length > 0}>
          <div style="margin-bottom: 1rem;">
            <A href="/app/capacity/new" class="btn">Lägg till kapacitet</A>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <For each={capacities()}>
              {(cap) => (
                <div class="card">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                    <div>
                      <p style="margin: 0; font-weight: 600;">{dateStr(cap)}</p>
                      <p style="margin: 0.25rem 0 0; color: var(--color-text-muted); font-size: 0.95rem;">
                        {sizesStr(cap.dog_sizes)} • {genderLabel[cap.dog_genders] ?? cap.dog_genders} • max {cap.max_dogs} hundar
                      </p>
                      {cap.notes && (
                        <p style="margin: 0.5rem 0 0; font-size: 0.9rem;">{cap.notes}</p>
                      )}
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                      <A href={`/app/capacity/edit/${cap.id}`} class="btn btn-secondary">
                        Redigera
                      </A>
                      <button
                        type="button"
                        class="btn btn-secondary"
                        style="color: #dc2626;"
                        onClick={() => handleDelete(cap.id)}
                      >
                        Ta bort
                      </button>
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
