import { A, useNavigate, useParams } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { ExcursionForm } from "~/components/ExcursionForm";
import { parseApiError } from "~/lib/errors";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import type { ExcursionVisibility } from "~/types";

type EditableExcursion = {
  id: string;
  title: string;
  description?: string;
  start_at: string;
  duration_hours?: number;
  share_phone_with_attendees?: boolean;
  meeting_area: string;
  meeting_map_url?: string;
  meeting_latitude?: number;
  meeting_longitude?: number;
  visibility: ExcursionVisibility;
  host_user: string;
  status?: string;
};

export default function ExcursionEditPage() {
  const params = useParams<{ id: string }>();
  const nav = useNavigate();

  const [item] = createResource(
    () => params.id,
    async (id) => {
      const rec = await pb.collection("excursions").getOne<EditableExcursion>(id);
      return rec;
    }
  );

  return (
    <AppShell>
      <div class="container" style="display: grid; gap: 1rem;">
        <div class="page-hero excursions-page-header">
          <div>
            <h1>Redigera hundträff</h1>
            <p style="margin: 0; color: var(--color-text-muted);">
              Uppdatera informationen för din hundträff.
            </p>
          </div>
          <A href="/app/excursions" class="btn btn-secondary">
            Tillbaka
          </A>
        </div>

        <Show when={item.loading}>
          <section class="card" style="padding: 1rem;">
            <p>Laddar...</p>
          </section>
        </Show>

        <Show when={item.error}>
          <section class="card" style="padding: 1rem;">
            <p style="color: #dc2626;">Kunde inte ladda hundträffen.</p>
            <A href="/app/excursions" class="btn btn-secondary">
              Tillbaka
            </A>
          </section>
        </Show>

        <Show when={item()}>
          {(rec) => (
            <Show when={rec().host_user === pb.authStore.model?.id} fallback={<section class="card" style="padding: 1rem;"><p>Du kan bara redigera hundträffar som du själv har skapat.</p></section>}>
              <ExcursionForm
                mode="edit"
                initial={rec()}
                cityHint={(pb.authStore.model?.city as string | undefined) ?? undefined}
                currentUserPhone={(pb.authStore.model?.phone as string | undefined) ?? undefined}
                submitLabel="Spara ändringar"
                submittingLabel="Sparar..."
                onSubmit={async (values) => {
                  try {
                    const { profile_phone_to_save, ...excursionValues } = values;
                    if (profile_phone_to_save && pb.authStore.model?.id) {
                      await pb.collection("users").update(pb.authStore.model.id, {
                        phone: profile_phone_to_save,
                      });
                      try {
                        await pb.collection("users").authRefresh();
                      } catch {}
                    }
                    await pb.collection("excursions").update(rec().id, excursionValues);
                    showToast("Hundträffen uppdaterades.");
                    nav(`/app/excursions/${rec().id}`);
                  } catch (err) {
                    showToast(parseApiError(err), "error");
                    throw err;
                  }
                }}
              />
            </Show>
          )}
        </Show>
      </div>
    </AppShell>
  );
}
