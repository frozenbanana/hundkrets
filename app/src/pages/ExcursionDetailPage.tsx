import { A, useParams } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { parseApiError } from "~/lib/errors";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import type { ExcursionVisibility } from "~/types";

type ExcursionListItem = {
  id: string;
  title: string;
  description?: string;
  start_at: string;
  duration_hours?: number;
  meeting_area: string;
  meeting_map_url?: string;
  visibility: ExcursionVisibility;
  status: string;
  host_user: string;
  host_name?: string;
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

function formatDuration(hours?: number) {
  if (typeof hours !== "number" || Number.isNaN(hours) || hours <= 0) return "2 timmar";
  const rounded = Number.isInteger(hours) ? hours : Number(hours.toFixed(1));
  return `${rounded} ${rounded === 1 ? "timme" : "timmar"}`;
}

export default function ExcursionDetailPage() {
  const params = useParams<{ id: string }>();
  const [detailError, setDetailError] = createSignal("");
  const [commentBody, setCommentBody] = createSignal("");
  const [commentParentId, setCommentParentId] = createSignal<string>("");
  const [submittingComment, setSubmittingComment] = createSignal(false);
  const [submittingInterest, setSubmittingInterest] = createSignal(false);

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
          pb.collection("users").getFullList<{ id: string; name?: string }>(),
        ]);

        const userNameById = new Map(usersRaw.map((u) => [u.id, u.name ?? "Användare"]));
        return {
          item: {
            id: itemRaw.id,
            title: itemRaw.title,
            description: itemRaw.description,
            start_at: itemRaw.start_at,
            duration_hours: itemRaw.duration_hours,
            meeting_area: itemRaw.meeting_area,
            meeting_map_url: itemRaw.meeting_map_url,
            visibility: itemRaw.visibility,
            status: itemRaw.status,
            host_user: itemRaw.host_user,
            host_name: userNameById.get(itemRaw.host_user) || "Användare",
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
        <A href="/app/excursions" class="profile-back-link">← Tillbaka till hundträffar</A>

        <Show when={detail.loading}>
          <p>Laddar hundträff...</p>
        </Show>

        <Show when={detail()}>
          {(d) => (
            <section class="card" style="padding: 1rem;">
              <div style="display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start;">
                <div>
                  <h1 style="margin-top: 0;">{d().item.title}</h1>
                  <p style="margin: 0 0 0.5rem; color: var(--color-text-muted);">
                    Arrangör: <A href={`/users/${d().item.host_user}`}>{d().item.host_name || "Användare"}</A>
                  </p>
                  <p style="margin: 0 0 0.5rem; color: var(--color-text-muted);">
                    {formatDate(d().item.start_at)} - {d().item.meeting_area}
                  </p>
                  <p style="margin: 0 0 0.5rem; color: var(--color-text-muted);">
                    Längd: {formatDuration(d().item.duration_hours)}
                  </p>
                  <Show when={d().item.meeting_map_url}>
                    <p style="margin: 0 0 0.5rem;">
                      <a href={d().item.meeting_map_url} target="_blank" rel="noreferrer">
                        Öppna mötesplats i Google Maps
                      </a>
                    </p>
                  </Show>
                  <Show when={d().item.description}>
                    <p style="margin: 0.5rem 0;">{d().item.description}</p>
                  </Show>
                </div>
              </div>

              <div style="margin: 1rem 0;">
                <button
                  type="button"
                  class="btn"
                  onClick={handleInterest}
                  disabled={submittingInterest() || d().item.viewer_interested}
                >
                  {d().item.viewer_interested ? "Du är intresserad" : submittingInterest() ? "Sparar..." : "Jag är intresserad"}
                </button>
              </div>

              <h3>Kommentarer</h3>
              <Show when={sortedComments().length > 0} fallback={<p>Inga kommentarer än.</p>}>
                <div style="display: grid; gap: 0.6rem;">
                  <For each={sortedComments()}>
                    {(comment) => (
                      <div class="card" style="padding: 0.65rem;">
                        <div style="font-size: 0.85rem; color: var(--color-text-muted);">
                          {comment.author_name || "Användare"} - {formatDate(comment.created)}
                          <Show when={comment.parent_comment}>
                            <span> (svar)</span>
                          </Show>
                        </div>
                        <div>{comment.body}</div>
                        <div style="margin-top: 0.4rem;">
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

              <div style="margin-top: 1rem; display: grid; gap: 0.5rem;">
                <Show when={commentParentId()}>
                  <p style="margin: 0; font-size: 0.85rem; color: var(--color-text-muted);">
                    Svarar på kommentar.
                    <button
                      type="button"
                      class="btn btn-secondary"
                      style="margin-left: 0.5rem;"
                      onClick={() => setCommentParentId("")}
                    >
                      Avbryt svar
                    </button>
                  </p>
                </Show>
                <textarea
                  class="input"
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
          )}
        </Show>

        <Show when={detailError()}>
          <section class="card" style="padding: 1rem;">
            <p style="color: #dc2626; margin: 0;">Kunde inte ladda vald hundträff: {detailError()}</p>
          </section>
        </Show>
      </div>
    </AppShell>
  );
}
