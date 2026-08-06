import { createResource, createSignal, For, Show } from "solid-js";
import {
  fetchOwnerMedia,
  mediaObjectUrl,
  reportMedia,
  type MediaRecord,
} from "~/lib/media";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

export function ProfileMediaGrid(props: { ownerId: string }) {
  const [items] = createResource(
    () => props.ownerId,
    (id) => fetchOwnerMedia(id, { limit: 60 })
  );
  const [active, setActive] = createSignal<MediaRecord | undefined>();

  async function handleReport() {
    const m = active();
    if (!m) return;
    try {
      await reportMedia(m.id, "Anmält från profil");
      showToast("Tack — innehållet är anmält");
      setActive(undefined);
    } catch (err) {
      showToast(parseApiError(err));
    }
  }

  const thumb = (m: MediaRecord) =>
    m.kind === "video" ? mediaObjectUrl(m.poster_key || m.object_key) : mediaObjectUrl(m.object_key);

  return (
    <section class="profile-media-section">
      <h2 style="margin: 0 0 0.75rem; font-size: 1.1rem;">Media</h2>
      <Show when={items.loading}>
        <p style="color: var(--color-text-muted);">Laddar media…</p>
      </Show>
      <Show when={!items.loading && (items() ?? []).length === 0}>
        <p style="color: var(--color-text-muted); margin: 0;">Ingen media ännu.</p>
      </Show>
      <Show when={(items() ?? []).length > 0}>
        <div class="profile-media-grid">
          <For each={items() ?? []}>
            {(m) => (
              <button type="button" class="profile-media-cell" onClick={() => setActive(m)}>
                <Show when={thumb(m)} fallback={<div class="profile-media-cell" />}>
                  <img src={thumb(m)!} alt="" />
                </Show>
                <Show when={m.kind === "video"}>
                  <span class="profile-media-cell-play" aria-hidden="true">
                    ▶
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={active()}>
        {(m) => (
          <div class="profile-media-lightbox" role="dialog" aria-modal="true" onClick={() => setActive(undefined)}>
            <Show
              when={m().kind === "video"}
              fallback={<img class="profile-media-lightbox-media" src={mediaObjectUrl(m().object_key)} alt="" onClick={(e) => e.stopPropagation()} />}
            >
              <video
                class="profile-media-lightbox-media"
                src={mediaObjectUrl(m().object_key)}
                poster={mediaObjectUrl(m().poster_key) || undefined}
                controls
                playsinline
                muted
                autoplay
                onClick={(e) => e.stopPropagation()}
              />
            </Show>
            <div class="profile-media-lightbox-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" class="btn btn-secondary" onClick={() => setActive(undefined)}>
                Stäng
              </button>
              <Show when={pb.authStore.isValid && pb.authStore.model?.id !== m().owner}>
                <button type="button" class="btn btn-secondary" onClick={handleReport}>
                  Anmäl
                </button>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </section>
  );
}
