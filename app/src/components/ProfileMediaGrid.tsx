import { createEffect, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import {
  fetchOwnerMedia,
  mediaObjectUrl,
  reportMedia,
  type MediaRecord,
} from "~/lib/media";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

export function ProfileMediaGrid(props: {
  ownerId: string;
  /** Own profile: richer empty state + upload CTA */
  isOwn?: boolean;
  /** Hide section heading when parent already shows "Media" */
  hideHeading?: boolean;
  /** Own empty-state / add CTA */
  onUploadClick?: () => void;
  /** Hide empty invite while capture UI is open above */
  hideEmptyCta?: boolean;
  /** Parent can call refetch after upload */
  onRefetchReady?: (refetch: () => void) => void;
  /** Notify parent when media list changes (e.g. profile quick actions). */
  onItemsChange?: (items: MediaRecord[]) => void;
}) {
  const [items, { refetch }] = createResource(
    () => props.ownerId,
    (id) => fetchOwnerMedia(id, { limit: 60 })
  );
  const [active, setActive] = createSignal<MediaRecord | undefined>();

  createEffect(() => {
    props.onRefetchReady?.(refetch);
  });

  createEffect(() => {
    const loaded = items();
    if (!items.loading && loaded) {
      props.onItemsChange?.(loaded);
    }
  });

  onCleanup(() => {
    props.onRefetchReady?.(() => {});
  });

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

  const isEmpty = () => !items.loading && (items() ?? []).length === 0;
  const hasItems = () => (items() ?? []).length > 0;
  /** Hide empty section for other users; own profile keeps the invite CTA */
  const showSection = () =>
    items.loading || hasItems() || (!!props.isOwn && !props.hideEmptyCta);

  return (
    <Show when={showSection()}>
    <section class="profile-media-section" classList={{ "profile-media-section-embedded": !!props.hideHeading }}>
      <Show when={!props.hideHeading}>
        <h2 style="margin: 0 0 0.75rem; font-size: 1.1rem;">Media</h2>
      </Show>
      <Show when={items.loading}>
        <p style="color: var(--color-text-muted);">Laddar media…</p>
      </Show>

      <Show when={isEmpty() && props.isOwn && !props.hideEmptyCta}>
        <div class="profile-media-empty">
          <p class="profile-media-empty-title">Inget klipp ännu</p>
          <p class="profile-media-empty-text">
            Ett kort klipp hjälper grannar känna din hund — max 15 sekunder räcker.
          </p>
          <Show when={props.onUploadClick}>
            <button
              type="button"
              class="btn"
              onClick={() => props.onUploadClick?.()}
              data-umami-event="Profile media empty CTA"
            >
              Spela in / ladda upp
            </button>
          </Show>
        </div>
      </Show>

      <Show when={hasItems()}>
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
        <Show when={props.isOwn && props.onUploadClick && !props.hideEmptyCta}>
          <button
            type="button"
            class="btn btn-secondary"
            style="margin-top: 0.75rem;"
            onClick={() => props.onUploadClick?.()}
            data-umami-event="Profile media add more"
          >
            Lägg till video
          </button>
        </Show>
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
    </Show>
  );
}
