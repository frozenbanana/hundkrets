import type PocketBase from "pocketbase";
import type { ExcursionVisibility } from "~/types";

export type ExploreExcursionItem = {
  id: string;
  created?: string;
  title: string;
  start_at: string;
  meeting_area: string;
  duration_hours?: number | string;
  visibility: ExcursionVisibility;
  meeting_latitude?: number;
  meeting_longitude?: number;
  meeting_map_url?: string;
  interest_count: number;
  comment_count: number;
};

/** Scheduled excursions with interest/comment counts (for Utforska hundträffar). */
export async function fetchExploreExcursions(pb: PocketBase): Promise<ExploreExcursionItem[]> {
  const list = await pb.collection("excursions").getFullList<{
    id: string;
    title: string;
    start_at: string;
    meeting_area: string;
    duration_hours?: number | string;
    visibility: ExcursionVisibility;
    meeting_latitude?: number;
    meeting_longitude?: number;
    meeting_map_url?: string;
    status?: string;
  }>({
    filter: `status = "scheduled"`,
    sort: "start_at",
  });

  if (list.length === 0) return [];

  const [interestsRaw, commentsRaw] = await Promise.all([
    pb.collection("excursion_interests").getFullList<{ excursion: string }>(),
    pb.collection("excursion_comments").getFullList<{ excursion: string }>(),
  ]);

  const interestBy = new Map<string, number>();
  const commentBy = new Map<string, number>();
  for (const r of interestsRaw) {
    interestBy.set(r.excursion, (interestBy.get(r.excursion) ?? 0) + 1);
  }
  for (const r of commentsRaw) {
    commentBy.set(r.excursion, (commentBy.get(r.excursion) ?? 0) + 1);
  }

  return list.map(
    (e): ExploreExcursionItem => ({
      id: e.id,
      created: (e as { created?: string }).created,
      title: e.title,
      start_at: e.start_at,
      meeting_area: e.meeting_area,
      duration_hours: e.duration_hours,
      visibility: e.visibility,
      meeting_latitude: e.meeting_latitude,
      meeting_longitude: e.meeting_longitude,
      meeting_map_url: e.meeting_map_url,
      interest_count: interestBy.get(e.id) ?? 0,
      comment_count: commentBy.get(e.id) ?? 0,
    })
  );
}
