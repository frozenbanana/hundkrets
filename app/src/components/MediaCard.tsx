import { createSignal, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { Avatar } from "~/components/Avatar";
import { DogImage } from "~/components/DogImage";
import {
  mediaObjectUrl,
  reportMedia,
  type MediaRecord,
} from "~/lib/media";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";
import type { Conn } from "../../routes/app/explore/types";
import type { ListingItem } from "../../routes/app/explore/helpers";
import { getFirstDog, formatLastLoginAgo } from "../../routes/app/explore/helpers";

export function MediaCard(props: {
  listing: ListingItem;
  baseUrl: string;
  media?: MediaRecord;
  getConnections: () => Conn[];
  onOpenProfile: (userId: string) => void;
  onQuickInterest: (userId: string) => void;
  onInterestWithMessage: (userId: string, userName?: string) => void;
}) {
  const { listing, baseUrl } = props;
  const [playing, setPlaying] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  let videoEl: HTMLVideoElement | undefined;
  let holdTimer: number | undefined;

  const me = () => pb.authStore.model?.id;
  const conns = () => props.getConnections();
  const mutual = () => {
    const m = me();
    if (!m) return false;
    const c = conns();
    return (
      c.some((x) => x.from_user === m && x.to_user === listing.user.id) &&
      c.some((x) => x.from_user === listing.user.id && x.to_user === m)
    );
  };
  const requestedOutgoing = () => {
    const m = me();
    if (!m) return false;
    return conns().some((x) => x.from_user === m && x.to_user === listing.user.id);
  };
  const requestedMe = () => {
    const m = me();
    if (!m) return false;
    return conns().some((x) => x.from_user === listing.user.id && x.to_user === m);
  };

  const firstDog = () => getFirstDog(listing);
  const locationStr = () => {
    const loc = listing.user.neighborhood || listing.user.city || listing.user.area;
    const dist =
      "distanceKm" in listing && typeof listing.distanceKm === "number"
        ? `~${Math.round(listing.distanceKm)} km`
        : null;
    if (loc && dist) return `${loc} · ${dist}`;
    return loc || dist || null;
  };

  const posterUrl = () => {
    const m = props.media;
    if (!m) return undefined;
    if (m.kind === "video") return mediaObjectUrl(m.poster_key || m.object_key);
    return mediaObjectUrl(m.object_key);
  };
  const videoUrl = () => {
    const m = props.media;
    if (!m || m.kind !== "video") return undefined;
    return mediaObjectUrl(m.object_key);
  };

  function startPlay() {
    setPlaying(true);
    const v = videoEl;
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  }
  function stopPlay() {
    setPlaying(false);
    const v = videoEl;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-media-action]")) return;
    if (!videoUrl()) return;
    holdTimer = window.setTimeout(() => startPlay(), 120);
  }
  function onPointerUp() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    }
    stopPlay();
  }

  async function handleReport() {
    const m = props.media;
    if (!m) return;
    setMenuOpen(false);
    try {
      await reportMedia(m.id, "Anmält från flöde");
      showToast("Tack — innehållet är anmält");
    } catch (err) {
      showToast(parseApiError(err));
    }
  }

  return (
    <article
      class="media-card"
      data-listing-id={listing.user.id}
      onMouseEnter={() => videoUrl() && startPlay()}
      onMouseLeave={stopPlay}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div
        class="media-card-media"
        role="button"
        tabIndex={0}
        onClick={() => props.onOpenProfile(listing.user.id)}
        onKeyDown={(e) => e.key === "Enter" && props.onOpenProfile(listing.user.id)}
      >
        <Show
          when={videoUrl()}
          fallback={
            <Show
              when={posterUrl()}
              fallback={
                <Show
                  when={firstDog()}
                  fallback={
                    <div class="media-card-placeholder">
                      <Avatar
                        id={listing.user.id}
                        name={listing.user.name}
                        avatar={listing.user.avatar}
                        avatar_key={(listing.user as { avatar_key?: string }).avatar_key}
                        baseUrl={baseUrl}
                        size="md"
                      />
                    </div>
                  }
                >
                  {(dog) => <DogImage dog={dog()} baseUrl={baseUrl} class="media-card-img" />}
                </Show>
              }
            >
              <img src={posterUrl()} alt="" class="media-card-img" />
            </Show>
          }
        >
          <img
            src={posterUrl() || ""}
            alt=""
            class="media-card-img"
            classList={{ "media-card-img-hidden": playing() }}
          />
          <video
            ref={(el) => (videoEl = el)}
            class="media-card-video"
            classList={{ "media-card-video-visible": playing() }}
            src={videoUrl()}
            muted
            playsinline
            loop
            preload="metadata"
          />
        </Show>
        <div class="media-card-avatar-corner">
          <Avatar
            id={listing.user.id}
            name={listing.user.name}
            avatar={listing.user.avatar}
            avatar_key={(listing.user as { avatar_key?: string }).avatar_key}
            baseUrl={baseUrl}
            size="sm"
          />
        </div>
        <Show when={mutual()}>
          <span class="media-card-badge">matchad</span>
        </Show>
        <Show when={!mutual() && requestedMe()}>
          <span class="media-card-badge media-card-badge-request">Vill ha kontakt</span>
        </Show>
        <Show when={!mutual() && requestedOutgoing()}>
          <span class="media-card-badge media-card-badge-outgoing">Intresse skickat</span>
        </Show>
      </div>

      <div class="media-card-footer">
        <div class="media-card-meta" onClick={() => props.onOpenProfile(listing.user.id)}>
          <strong class="media-card-name">{listing.user.name || "Okänd"}</strong>
          <Show when={firstDog()}>
            {(dog) => <span class="media-card-dog">{dog().name}</span>}
          </Show>
          <Show when={locationStr()}>
            <span class="media-card-loc">{locationStr()}</span>
          </Show>
          <Show when={formatLastLoginAgo((listing.user as { last_login_at?: string }).last_login_at)}>
            {(ago) => <span class="media-card-ago">{ago()}</span>}
          </Show>
        </div>
        <div class="media-card-actions" data-media-action>
          <Show when={!mutual() && !requestedOutgoing()}>
            <button
              type="button"
              class="media-card-heart"
              title="Jag är intresserad"
              aria-label="Jag är intresserad"
              data-umami-event="Quick interest"
              onClick={(e) => {
                e.stopPropagation();
                props.onQuickInterest(listing.user.id);
              }}
            >
              <span aria-hidden="true">♥</span>
              <span class="media-card-heart-label">Intresse</span>
            </button>
            <button
              type="button"
              class="media-card-msg-btn"
              title="Intresse med meddelande"
              aria-label="Intresse med meddelande"
              onClick={(e) => {
                e.stopPropagation();
                props.onInterestWithMessage(listing.user.id, listing.user.name);
              }}
            >
              ✎
            </button>
          </Show>
          <Show when={props.media}>
            <div class="media-card-menu-wrap">
              <button
                type="button"
                class="media-card-menu-btn"
                aria-label="Mer"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
              >
                ⋯
              </button>
              <Show when={menuOpen()}>
                <div class="media-card-menu">
                  <button type="button" onClick={handleReport}>
                    Anmäl
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </article>
  );
}
