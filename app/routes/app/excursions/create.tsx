import { A, useNavigate } from "@solidjs/router";
import { AppShell } from "~/components/AppShell";
import { ExcursionForm } from "~/components/ExcursionForm";
import { parseApiError } from "~/lib/errors";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";

export default function ExcursionCreatePage() {
  const nav = useNavigate();

  return (
    <AppShell>
      <div class="container excursions-page">
        <div class="page-hero excursions-page-header">
          <div>
            <h1>Ny hundträff</h1>
            <p style="margin: 0; color: var(--color-text-muted);">
              Skapa en ny hundträff och bjud in andra i Hundkrets.
            </p>
          </div>
          <A href="/app/excursions" class="btn btn-secondary">
            Tillbaka
          </A>
        </div>

        <ExcursionForm
          mode="create"
          cityHint={(pb.authStore.model?.city as string | undefined) ?? undefined}
          currentUserPhone={(pb.authStore.model?.phone as string | undefined) ?? undefined}
          submitLabel="Publicera hundträff"
          submittingLabel="Publicerar..."
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
              await pb.collection("excursions").create({
                ...excursionValues,
                status: "scheduled",
              });
              showToast("Hundträff publicerad.");
              nav("/app/excursions");
            } catch (err) {
              showToast(parseApiError(err), "error");
              throw err;
            }
          }}
        />
      </div>
    </AppShell>
  );
}
