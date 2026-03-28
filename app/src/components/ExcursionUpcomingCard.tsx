import { A } from "@solidjs/router";
import { Show, createMemo } from "solid-js";
import type { ExcursionVisibility } from "~/types";
import {
  EXCURSION_VISIBILITY_LABELS,
  excursionMapThumbUrl,
  formatExcursionCardWhen,
  formatExcursionDurationShort,
} from "~/lib/excursionCard";

export type ExcursionUpcomingCardProps = {
  href: string;
  title: string;
  startAt: string;
  meetingArea: string;
  visibility: ExcursionVisibility;
  durationHours?: number;
  interestCount: number;
  commentCount: number;
  meetingLatitude?: number;
  meetingLongitude?: number;
};

function IconHeart(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconMessage(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="16"
      height="16"
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

function IconMapPin(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function ExcursionUpcomingCard(props: ExcursionUpcomingCardProps) {
  const when = createMemo(() => formatExcursionCardWhen(props.startAt));
  const mapSrc = createMemo(() => excursionMapThumbUrl(props.meetingLatitude, props.meetingLongitude));

  const visibilityClass = () => {
    switch (props.visibility) {
      case "public":
        return "excursions-card-badge--vis-public";
      case "matched_only":
        return "excursions-card-badge--vis-matched_only";
      case "interested_by_me":
        return "excursions-card-badge--vis-interested_by_me";
      default:
        return "excursions-card-badge--vis-public";
    }
  };

  return (
    <A href={props.href} class="card excursions-list-card">
      <div class="excursions-list-card-body">
        <div class="excursions-list-card-main">
          <div class="excursions-list-card-badges">
            <span class="excursions-card-badge excursions-card-badge--time">
              <span class="excursions-card-badge-time-line">
                <span class="excursions-card-badge-weekday">{when().weekday}</span>
                <span class="excursions-card-badge-middot" aria-hidden="true">
                  ·
                </span>
                <span>{when().datePart}</span>
                <span class="excursions-card-badge-middot" aria-hidden="true">
                  ·
                </span>
                <span>{when().timePart}</span>
              </span>
            </span>
            <span class={`excursions-card-badge excursions-card-badge--visibility ${visibilityClass()}`}>
              {EXCURSION_VISIBILITY_LABELS[props.visibility]}
            </span>
          </div>
          <h3 class="excursions-list-card-title">{props.title}</h3>
          <p class="excursions-list-card-place">{props.meetingArea}</p>
          <div class="excursions-list-card-meta">
            <span class="excursions-list-stat" title="Intresserade">
              <IconHeart />
              <span>{props.interestCount}</span>
            </span>
            <span class="excursions-list-stat" title="Kommentarer">
              <IconMessage />
              <span>{props.commentCount}</span>
            </span>
            <span class="excursions-list-duration">{formatExcursionDurationShort(props.durationHours)}</span>
          </div>
        </div>
        <div class="excursions-list-card-thumb" aria-hidden="true">
          <Show
            when={mapSrc()}
            fallback={
              <div class="excursions-list-card-thumb-placeholder">
                <IconMapPin />
              </div>
            }
          >
            {(src) => (
              <img src={src} alt="" loading="lazy" decoding="async" width="240" height="144" />
            )}
          </Show>
        </div>
      </div>
    </A>
  );
}
