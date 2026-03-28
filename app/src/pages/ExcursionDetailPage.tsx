import { A, useParams } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { formatDogInfo } from "~/components/DogInfo";
import { ExcursionReadOnlyMap } from "~/components/ExcursionReadOnlyMap";
import { parseApiError } from "~/lib/errors";
import {
  EXCURSION_VISIBILITY_LABELS,
  excursionPreviewCoords,
  excursionVisibilityBadgeClass,
  formatExcursionDurationHours,
  formatExcursionWhen,
} from "~/lib/excursionListCard";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import type { Dog, ExcursionVisibility } from "~/types";

const pbBaseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://localhost:8090";

type ExcursionListItem = {
  id: string;
  title: string;
  description?: string;
  start_at: string;
  duration_hours?: number;
  meeting_area: string;
  meeting_map_url?: string;
  meeting_latitude?: number;
  meeting_longitude?: number;
  visibility: ExcursionVisibility;
  status: string;
  host_user: string;
  host_name?: string;
  host_avatar?: string;
  interest_count: number;
  comment_count: number;
  viewer_interested: boolean;
};

type ExcursionCommentItem = {
  id: string;
  author: string;
  author_name?: string;
  body: string;
  parent_comment?: string;
  created?: string;
};

type ExcursionInterestItem = {
  id: string;
  user: string;
  user_name?: string;
  user_avatar?: string;
};

type ExcursionDetailResponse = {
  item: ExcursionListItem;
  comments: ExcursionCommentItem[];
  interests: ExcursionInterestItem[];
};

function formatDate(value?: string) {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function mapsOpenHref(
  meetingMapUrl: string | undefined,
  lat: number | undefined,
  lon: number | undefined
): string | undefined {
  const u = meetingMapUrl?.trim();
  if (u) return u;
  if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }
  return undefined;
}

function mapsDirectionsHref(lat: number, lon: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

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

function IconDirections(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2 4 20.5l.8.5L12 18l7.2 3 .8-.5L12 2zm-1 14.1V8.4l5.5 9.6-5.5-2.9z" />
    </svg>
  );
}

type InterestModalRow = {
  userId: string;
  name: string;
  avatar: string;
  dogs: Dog[];
};

function pocketOrClause(field: string, ids: string[]): string {
  if (ids.length === 0) return 'id = ""';
  const clauses = ids.map((id) => `${field} = "${id.replace(/"/g, "")}"`);
  return clauses.length === 1 ? clauses[0]! : `(${clauses.join(" || ")})`;
}

export default function ExcursionDetailPage() {
  const params = useParams<{ id: string }>();
  const [detailError, setDetailError] = createSignal("");
  const [commentBody, setCommentBody] = createSignal("");
  const [commentParentId, setCommentParentId] = createSignal<string>("");
  const [submittingComment, setSubmittingComment] = createSignal(false);
  const [submittingInterest, setSubmittingInterest] = createSignal(false);
  const [interestModalOpen, setInterestModalOpen] = createSignal(false);
  const [interestModalRows, setInterestModalRows] = createSignal<InterestModalRow[]>([]);
  const [interestModalLoading, setInterestModalLoading] = createSignal(false);

  const [detail, { refetch }] = createResource(
    () => params.id,
    async (id): Promise<ExcursionDetailResponse | null> => {
      if (!id) return null;
      try {
        setDetailError("");
        const me = pb.authStore.model?.id;
        const [itemRaw, commentsRaw, interestsRaw, usersRaw] = await Promise.all([
          pb.collection("excursions").getOne<{
            id: string;
            title: string;
            description?: string;
            start_at: string;
            duration_hours?: number;
            meeting_area: string;
            meeting_map_url?: string;
            meeting_latitude?: number;
            meeting_longitude?: number;
            visibility: ExcursionVisibility;
            status: string;
            host_user: string;
          }>(id),
          pb.collection("excursion_comments").getFullList<{
            id: string;
            excursion: string;
            author: string;
            body: string;
            parent_comment?: string;
            created?: string;
          }>({ filter: `excursion = "${id}"` }),
          pb.collection("excursion_interests").getFullList<{
            id: string;
            excursion: string;
            user: string;
          }>({ filter: `excursion = "${id}"` }),
          pb.collection("users").getFullList<{ id: string; name?: string; avatar?: string }>(),
        ]);

        const userNameById = new Map(usersRaw.map((u) => [u.id, u.name ?? "Användare"]));
        const userAvatarById = new Map(usersRaw.map((u) => [u.id, u.avatar ?? ""]));
        const hostAvatar = userAvatarById.get(itemRaw.host_user) ?? "";

        return {
          item: {
            id: itemRaw.id,
            title: itemRaw.title,
            description: itemRaw.description,
            start_at: itemRaw.start_at,
            duration_hours: itemRaw.duration_hours,
            meeting_area: itemRaw.meeting_area,
            meeting_map_url: itemRaw.meeting_map_url,
            meeting_latitude: itemRaw.meeting_latitude,
            meeting_longitude: itemRaw.meeting_longitude,
            visibility: itemRaw.visibility,
            status: itemRaw.status,
            host_user: itemRaw.host_user,
            host_name: userNameById.get(itemRaw.host_user) || "Användare",
            host_avatar: hostAvatar,
            interest_count: interestsRaw.length,
            comment_count: commentsRaw.length,
            viewer_interested: !!me && interestsRaw.some((i) => i.user === me),
          },
          comments: commentsRaw.map((c) => ({
            id: c.id,
            author: c.author,
            author_name: userNameById.get(c.author) || "Användare",
            body: c.body,
            parent_comment: c.parent_comment,
            created: c.created,
          })),
          interests: interestsRaw.map((i) => ({
            id: i.id,
            user: i.user,
            user_name: userNameById.get(i.user) || "Användare",
            user_avatar: userAvatarById.get(i.user) || "",
          })),
        };
      } catch (err) {
        setDetailError(parseApiError(err));
        return null;
      }
    }
  );

  const sortedComments = createMemo(() => {
    const d = detail();
    if (!d?.comments) return [];
    return [...d.comments].sort((a, b) => (a.created ?? "").localeCompare(b.created ?? ""));
  });

  const meetingCoords = createMemo(() => {
    const d = detail();
    if (!d) return undefined;
    return excursionPreviewCoords(
      d.item.meeting_latitude,
      d.item.meeting_longitude,
      d.item.meeting_map_url
    );
  });

  async function handleInterest() {
    const id = params.id;
    if (!id) return;
    setSubmittingInterest(true);
    try {
      await pb.collection("excursion_interests").create({ excursion: id });
      showToast("Intresse registrerat.");
      await refetch();
    } catch (err) {
      showToast(parseApiError(err), "error");
    } finally {
      setSubmittingInterest(false);
    }
  }

  async function openInterestModal() {
    const d = detail();
    if (!d || d.interests.length === 0) return;
    setInterestModalOpen(true);
    setInterestModalLoading(true);
    try {
      const userIds = [...new Set(d.interests.map((i) => i.user))];
      const [usersRaw, dogsRaw] = await Promise.all([
        pb.collection("users").getFullList<{ id: string; name?: string; avatar?: string }>({
          filter: pocketOrClause("id", userIds),
        }),
        pb.collection("dogs").getFullList<Dog>({ filter: pocketOrClause("owner", userIds) }),
      ]);
      const userById = new Map(usersRaw.map((u) => [u.id, u]));
      const dogsByOwner = new Map<string, Dog[]>();
      for (const dog of dogsRaw) {
        const list = dogsByOwner.get(dog.owner) ?? [];
        list.push(dog);
        dogsByOwner.set(dog.owner, list);
      }
      const rows: InterestModalRow[] = userIds
        .map((uid) => {
          const u = userById.get(uid);
          return {
            userId: uid,
            name: u?.name?.trim() || "Användare",
            avatar: u?.avatar?.trim() ?? "",
            dogs: (dogsByOwner.get(uid) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "sv")),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
      setInterestModalRows(rows);
    } catch (err) {
      showToast(parseApiError(err), "error");
      setInterestModalOpen(false);
    } finally {
      setInterestModalLoading(false);
    }
  }

  async function submitComment() {
    const id = params.id;
    if (!id) return;
    const body = commentBody().trim();
    if (!body) return;
    setSubmittingComment(true);
    try {
      await pb.collection("excursion_comments").create({
        excursion: id,
        body,
        ...(commentParentId() ? { parent_comment: commentParentId() } : {}),
      });
      setCommentBody("");
      setCommentParentId("");
      await refetch();
    } catch (err) {
      showToast(parseApiError(err), "error");
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <AppShell>
      <div class="container excursions-page">
        <A href="/app/excursions" class="profile-back-link">
          ← Tillbaka till hundträffar
        </A>

        <Show when={detail.loading}>
          <p>Laddar hundträff...</p>
        </Show>

        <Show when={detail()}>
          {(d) => {
            const item = () => d().item;
            const when = () => formatExcursionWhen(item().start_at);
            const durationText = () => formatExcursionDurationHours(item().duration_hours);
            const openHref = () =>
              mapsOpenHref(
                item().meeting_map_url,
                meetingCoords()?.lat,
                meetingCoords()?.lon
              );

            return (
              <section class="card excursion-detail-card">
                <h1 class="excursion-detail__title">{item().title}</h1>

                <Show when={meetingCoords()}>
                  {(c) => <ExcursionReadOnlyMap lat={c().lat} lon={c().lon} class="excursion-detail__map" />}
                </Show>

                <div class="excursion-detail__badges excursions-list-card__badges">
                  <span class="excursions-card-badge excursions-card-badge--time">
                    <IconClock class="excursions-card-badge__icon" />
                    <span class="excursions-card-badge__text">
                      <span class="excursions-card-badge__date">{when().date}</span>
                      <span class="excursions-card-badge__clock">{when().time}</span>
                    </span>
                  </span>
                  <span
                    class={`excursions-card-badge excursions-card-badge--visibility ${excursionVisibilityBadgeClass(item().visibility)}`}
                  >
                    {EXCURSION_VISIBILITY_LABELS[item().visibility]}
                  </span>
                </div>

                <p class="excursions-list-card__place excursion-detail__place">{item().meeting_area}</p>

                <div class="excursions-list-card__stats excursion-detail__stats" aria-label="Längd, intresse och kommentarer">
                  <span class="excursions-list-card__stat excursions-list-card__stat--duration" title="Beräknad längd">
                    {durationText()}
                  </span>
                  <span class="excursions-list-card__stat" title="Antal intresserade">
                    <IconHeart class="excursions-list-card__stat-icon" />
                    {item().interest_count}
                  </span>
                  <span class="excursions-list-card__stat" title="Antal kommentarer">
                    <IconComment class="excursions-list-card__stat-icon" />
                    {item().comment_count}
                  </span>
                </div>

                <div class="excursion-detail__host-row">
                  <div class="excursion-detail__host">
                    <Avatar
                      name={item().host_name}
                      id={item().host_user}
                      avatar={item().host_avatar}
                      baseUrl={pbBaseUrl}
                      size="sm"
                    />
                    <div>
                      <div class="excursion-detail__host-label">Arrangör</div>
                      <A href={`/users/${item().host_user}`} class="excursion-detail__host-name">
                        {item().host_name || "Användare"}
                      </A>
                    </div>
                  </div>

                  <Show when={d().interests.length > 0} fallback={
                    <span class="excursion-detail__interest-empty">0 intresserade</span>
                  }>
                    <button
                      type="button"
                      class="excursion-detail__interest-stack"
                      onClick={openInterestModal}
                      title={`${item().interest_count} intresserade – klicka för att se listan`}
                    >
                      <div class="excursion-detail__interest-avatars">
                        <For each={d().interests.slice(0, 5)}>
                          {(interest) => (
                            <Avatar
                              name={interest.user_name}
                              id={interest.user}
                              avatar={interest.user_avatar}
                              baseUrl={pbBaseUrl}
                              size="sm"
                              class="excursion-detail__interest-avatar"
                            />
                          )}
                        </For>
                        <Show when={d().interests.length > 5}>
                          <span class="excursion-detail__interest-more">
                            +{d().interests.length - 5}
                          </span>
                        </Show>
                      </div>
                      <span class="excursion-detail__interest-label">
                        {item().interest_count} intresserad{item().interest_count !== 1 ? "e" : ""}
                      </span>
                    </button>
                  </Show>
                </div>

                <Show when={openHref()}>
                  <div class="excursion-detail__maps-row" aria-label="Google Maps">
                    <a
                      href={openHref()!}
                      target="_blank"
                      rel="noreferrer"
                      class="excursions-maps-icon-link"
                      title="Öppna i Google Maps"
                    >
                      <img src="https://maps.gstatic.com/favicon3.ico" alt="" width="18" height="18" />
                    </a>
                    <Show when={meetingCoords()}>
                      {(c) => (
                        <a
                          href={mapsDirectionsHref(c().lat, c().lon)}
                          target="_blank"
                          rel="noreferrer"
                          class="excursions-maps-icon-link"
                          title="Vägbeskrivning i Google Maps"
                        >
                          <IconDirections />
                        </a>
                      )}
                    </Show>
                  </div>
                </Show>

                <Show when={item().description}>
                  <p class="excursion-detail__description">{item().description}</p>
                </Show>

                <div class="excursion-detail__actions">
                  <button
                    type="button"
                    class="btn"
                    onClick={handleInterest}
                    disabled={submittingInterest() || item().viewer_interested}
                  >
                    {item().viewer_interested
                      ? "Du är intresserad"
                      : submittingInterest()
                        ? "Sparar..."
                        : "Jag är intresserad"}
                  </button>
                </div>

                <h3 class="excursion-detail__comments-heading">Kommentarer</h3>
                <Show when={sortedComments().length > 0} fallback={<p>Inga kommentarer än.</p>}>
                  <div class="excursion-detail__comment-list">
                    <For each={sortedComments()}>
                      {(comment) => (
                        <div class="card excursion-detail__comment-bubble">
                          <div class="excursion-detail__comment-meta">
                            {comment.author_name || "Användare"} – {formatDate(comment.created)}
                            <Show when={comment.parent_comment}>
                              <span> (svar)</span>
                            </Show>
                          </div>
                          <div>{comment.body}</div>
                          <div class="excursion-detail__comment-reply">
                            <button
                              type="button"
                              class="btn btn-secondary"
                              onClick={() => setCommentParentId(comment.id)}
                            >
                              Svara
                            </button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <div class="excursion-detail__compose">
                  <Show when={commentParentId()}>
                    <p class="excursion-detail__reply-hint">
                      Svarar på kommentar.{" "}
                      <button type="button" class="btn btn-secondary" onClick={() => setCommentParentId("")}>
                        Avbryt svar
                      </button>
                    </p>
                  </Show>
                  <textarea
                    class="excursion-detail-comment-input"
                    rows={3}
                    placeholder="Skriv en kommentar..."
                    value={commentBody()}
                    onInput={(e) => setCommentBody(e.currentTarget.value)}
                  />
                  <div>
                    <button type="button" class="btn" onClick={submitComment} disabled={submittingComment()}>
                      {submittingComment() ? "Skickar..." : "Skicka kommentar"}
                    </button>
                  </div>
                </div>
              </section>
            );
          }}
        </Show>

        <Show when={detailError()}>
          <section class="card" style="padding: 1rem;">
            <p style="color: #dc2626; margin: 0;">Kunde inte ladda vald hundträff: {detailError()}</p>
          </section>
        </Show>
      </div>

      <Show when={interestModalOpen()}>
        <div class="modal-backdrop" onClick={() => setInterestModalOpen(false)}>
          <div class="modal excursion-interest-modal" onClick={(e) => e.stopPropagation()}>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h2 style="margin: 0; font-size: 1.15rem;">Intresselista</h2>
              <button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 1.1rem; line-height: 1;" onClick={() => setInterestModalOpen(false)} aria-label="Stäng">
                &times;
              </button>
            </div>
            <Show when={interestModalLoading()}>
              <p style="padding: 1rem;">Laddar...</p>
            </Show>
            <Show when={!interestModalLoading() && interestModalRows().length === 0}>
              <p style="padding: 1rem;">Ingen har anmält intresse än.</p>
            </Show>
            <Show when={!interestModalLoading() && interestModalRows().length > 0}>
              <ul class="excursion-interest-modal__list">
                <For each={interestModalRows()}>
                  {(row) => (
                    <li class="excursion-interest-modal__entry">
                      <div class="excursion-interest-modal__user">
                        <Avatar
                          name={row.name}
                          id={row.userId}
                          avatar={row.avatar}
                          baseUrl={pbBaseUrl}
                          size="sm"
                        />
                        <A href={`/users/${row.userId}`} class="excursion-interest-modal__user-name">
                          {row.name}
                        </A>
                      </div>
                      <Show when={row.dogs.length > 0} fallback={
                        <p class="excursion-interest-modal__no-dogs">Inga hundar registrerade</p>
                      }>
                        <ul class="excursion-interest-modal__dog-list">
                          <For each={row.dogs}>
                            {(dog) => (
                              <li class="excursion-interest-modal__dog-item">
                                {formatDogInfo({
                                  name: dog.name,
                                  breed: dog.breed,
                                  gender: dog.gender,
                                  size: dog.size,
                                  showSize: !dog.breed?.trim(),
                                })}
                              </li>
                            )}
                          </For>
                        </ul>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </div>
      </Show>
    </AppShell>
  );
}
