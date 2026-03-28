import { A } from "@solidjs/router";
import { Show } from "solid-js";
import type { ExcursionVisibility } from "~/types";
import {
  EXCURSION_VISIBILITY_LABELS,
  excursionPreviewMapLayout,
  excursionVisibilityBadgeClass,
  formatExcursionDurationHours,
  formatExcursionWhen,
} from "~/lib/excursionListCard";

export type ExcursionListCardProps = {
  id: string;
  /** Optional detail href (defaults to /app/excursions/:id). */
  href?: string;
  title: string;
  start_at: string;
  meeting_area: string;
  duration_hours?: number;
  visibility: ExcursionVisibility;
  interest_count: number;
  comment_count: number;
  meeting_latitude?: number;
  meeting_longitude?: number;
  meeting_map_url?: string;
  /** Mindre karta på Utforska */
  compact?: boolean;
  /** Dölj miniatyrkarta (t.ex. desktop när huvudkartan visar samma) */
  hideMapThumb?: boolean;
  /** Optional edit link for own excursions */
  editHref?: string;
  /** Notify parent when card hover starts/ends (desktop interactions). */
  onHoverChange?: (id: string | undefined) => void;
};

function IconClock(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconHeart(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0Z" />
    </svg>
  );
}

function IconComment(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ExcursionListCard(props: ExcursionListCardProps) {
  const when = () => formatExcursionWhen(props.start_at);
  const mapLayout = () =>
    excursionPreviewMapLayout(props.meeting_latitude, props.meeting_longitude, props.meeting_map_url);
  const durationText = () => formatExcursionDurationHours(props.duration_hours);
  const detailHref = () => props.href ?? `/app/excursions/${props.id}`;

  return (
    <div
      classList={{
        "excursions-list-card": true,
        card: true,
        "excursions-list-card--compact": !!props.compact,
      }}
      onMouseEnter={() => props.onHoverChange?.(props.id)}
      onMouseLeave={() => props.onHoverChange?.(undefined)}
    >
      <div class="excursions-list-card__top-row">
        <div class="excursions-list-card__badges">
          <span class="excursions-card-badge excursions-card-badge--time">
            <IconClock class="excursions-card-badge__icon" />
            <span class="excursions-card-badge__text">
              <span class="excursions-card-badge__date">{when().date}</span>
              <span class="excursions-card-badge__clock">{when().time}</span>
            </span>
          </span>
          <span
            class={`excursions-card-badge excursions-card-badge--visibility ${excursionVisibilityBadgeClass(props.visibility)}`}
          >
            {EXCURSION_VISIBILITY_LABELS[props.visibility]}
          </span>
        </div>
        <Show when={props.editHref}>
          <A href={props.editHref!} class="btn btn-secondary excursions-card-inline-edit-btn">
            Redigera
          </A>
        </Show>
      </div>
      <A href={detailHref()} class="excursions-list-card__link-body">
      <div class="excursions-list-card__inner">
        <div class="excursions-list-card__main">
          <h3 class="excursions-list-card__title">{props.title}</h3>
          <p class="excursions-list-card__place">{props.meeting_area}</p>
          <div class="excursions-list-card__stats" aria-label="Längd, intresse och kommentarer">
            <span class="excursions-list-card__stat excursions-list-card__stat--duration" title="Beräknad längd">
              {durationText()}
            </span>
            <span class="excursions-list-card__stat" title="Antal som kommer">
              <IconHeart class="excursions-list-card__stat-icon" />
              {props.interest_count}
            </span>
            <span class="excursions-list-card__stat" title="Antal kommentarer">
              <IconComment class="excursions-list-card__stat-icon" />
              {props.comment_count}
            </span>
          </div>
        </div>
        <div
          class="excursions-list-card__thumb-wrap"
          classList={{ "excursions-list-card__thumb-wrap--hidden": !!props.hideMapThumb }}
        >
          <Show
            when={mapLayout()}
            fallback={
              <div class="excursions-list-card__thumb excursions-list-card__thumb--placeholder" aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
            }
          >
            {(layout) => (
              <div
                class="excursions-list-card__thumb excursions-list-card__map"
                aria-hidden="true"
              >
                <img
                  class="excursions-list-card__map-layer"
                  src={layout().tileUrl}
                  alt=""
                  width="256"
                  height="256"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  style={{
                    left: `calc(50% - ${layout().offsetX}px)`,
                    top: `calc(50% - ${layout().offsetY}px)`,
                  }}
                />
                <div class="excursions-list-card__map-pin">
                  <svg width="26" height="32" viewBox="0 0 26 32" aria-hidden="true">
                    <path
                      fill="var(--color-paw, #c45c3e)"
                      stroke="#fff"
                      stroke-width="1.5"
                      d="M13 0C7.3 0 3 4.1 3 9.8c0 6.4 7.5 15.4 9.6 17.9.4.5 1.4.5 1.8 0C16.5 25.2 23 16.2 23 9.8 23 4.1 18.7 0 13 0Z"
                    />
                    <circle cx="13" cy="10" r="3.2" fill="#fff" />
                  </svg>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
      </A>
    </div>
  );
}
