import { A, useNavigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { AppShell } from "~/components/AppShell";

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function dateStr(n: {
  flexible_dates?: boolean;
  open_any_duration?: boolean;
  duration_specific?: string;
  start_date?: string;
  end_date?: string;
}) {
  if (!n.flexible_dates && n.start_date && n.end_date) {
    return `${formatDate(n.start_date)} – ${formatDate(n.end_date)}`;
  }
  if (n.flexible_dates) {
    if (n.open_any_duration !== false) return "Flexibel, valfri längd";
    return n.duration_specific ? `Flexibel: ${n.duration_specific}` : "Flexibel";
  }
  return "—";
}

export default function NeedsList() {
  const nav = useNavigate();

  const [needs, { refetch }] = createResource(
    () => pb.authStore.model?.id,
    async (userId) => {
      if (!userId) return [];
      return pb.collection("watch_needs").getFullList({
        filter: `user = "${userId}"`,
        expand: "dog",
      });
    }
  );

  if (!pb.authStore.model?.id) {
    nav("/login", { replace: true });
    return null;
  }

  async function handleDelete(id: string) {
    if (!confirm("Är du säker på att du vill ta bort detta behov?")) return;
    try {
      await pb.collection("watch_needs").delete(id);
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
          <h1>Mina behov</h1>
          <p style="color: var(--color-text-muted);">
            När behöver du hundpassning? Exakta tider bestäms privat med matchningen.
          </p>
        </div>
        <Show when={needs.loading}>
          <p style="color: var(--color-text-muted);">Laddar...</p>
        </Show>
        <Show when={needs.error}>
          <p style="color: #dc2626;">{needs.error?.message}</p>
        </Show>
        <Show when={needs() && needs()!.length === 0}>
          <div class="card">
            <p style="color: var(--color-text-muted);">Inga behov ännu. Lägg till när du behöver hundpassning.</p>
            <A href="/app/needs/new" class="btn" style="margin-top: 1rem;">Lägg till behov</A>
          </div>
        </Show>
        <Show when={needs() && needs()!.length > 0}>
          <div style="margin-bottom: 1rem;">
            <A href="/app/needs/new" class="btn">Lägg till behov</A>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <For each={needs()}>
              {(need) => {
                // Handle dog as either single object or array
                const dogExpand = need.expand?.dog;
                const dogs = Array.isArray(dogExpand) ? dogExpand : dogExpand ? [dogExpand] : [];
                const dogNames = dogs.map((d) => d.name).filter(Boolean).join(", ") || "Hund";
                return (
                  <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                      <div>
                        <h3 style="margin: 0 0 0.5rem;">{dogNames}</h3>
                        <p style="margin: 0; color: var(--color-text-muted); font-size: 0.95rem;">
                          {dateStr(need)}
                        </p>
                        {need.notes && (
                          <p style="margin: 0.5rem 0 0; font-size: 0.9rem;">{need.notes}</p>
                        )}
                      </div>
                      <div style="display: flex; gap: 0.5rem;">
                        <A href={`/app/needs/edit/${need.id}`} class="btn btn-secondary">
                          Redigera
                        </A>
                        <button
                          type="button"
                          class="btn btn-secondary"
                          style="color: #dc2626;"
                          onClick={() => handleDelete(need.id)}
                        >
                          Ta bort
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </AppShell>
  );
}
