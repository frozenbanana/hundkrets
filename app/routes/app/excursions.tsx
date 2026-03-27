import { A } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import { AppShell } from "~/components/AppShell";
import { parseApiError } from "~/lib/errors";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { searchAddress, searchCitiesSweden } from "~/lib/geocode";
import type { ExcursionVisibility } from "~/types";

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

const visibilityLabels: Record<ExcursionVisibility, string> = {
  public: "Publik",
  matched_only: "Ömsesidigt matchade",
  interested_by_me: "De jag visat intresse för",
};

type ReverseResponse = {
  display_name?: string;
  address?: {
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
  };
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

function toDatetimeLocalAtThreePm(date = new Date()) {
  const d = new Date(date);
  d.setHours(15, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function visibilityTitlePart(value: ExcursionVisibility): string {
  if (value === "public") return "alla välkomna";
  if (value === "matched_only") return "för matchade";
  return "för intressekontakter";
}

function buildSuggestedTitle(area: string, visibility: ExcursionVisibility, durationHours: number) {
  const place = area.trim() || "området";
  const duration = formatDuration(durationHours).toLowerCase();
  return `Hundträff i ${place} - ${visibilityTitlePart(visibility)}, ${duration}`;
}

function buildGoogleMapsUrl(lat: number, lon: number) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function pickMeetingAreaName(response: ReverseResponse): string {
  const addr = response.address;
  return (
    addr?.neighbourhood ||
    addr?.suburb ||
    addr?.city_district ||
    addr?.village ||
    addr?.town ||
    addr?.city ||
    addr?.county ||
    (response.display_name ? response.display_name.split(",")[0]?.trim() : "") ||
    "Vald plats"
  );
}

async function reverseGeocodeArea(lat: number, lon: number): Promise<string> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Reverse geocode failed");
  const data = (await res.json()) as ReverseResponse;
  return pickMeetingAreaName(data);
}

async function forwardGeocodeArea(area: string, cityHint?: string): Promise<{ lat: number; lon: number } | null> {
  const q = area.trim();
  if (!q) return null;
  // 1) Try scoped address/place search first (better precision when city is known)
  try {
    const scoped = await searchAddress(q, cityHint ? { city: cityHint } : undefined);
    if (scoped[0]) return { lat: scoped[0].lat, lon: scoped[0].lon };
  } catch {
    // continue fallback chain
  }

  // 2) Try unscoped address/place search
  try {
    const unscoped = await searchAddress(q);
    if (unscoped[0]) return { lat: unscoped[0].lat, lon: unscoped[0].lon };
  } catch {
    // continue fallback chain
  }

  // 3) Try city/place-oriented search (useful for area names)
  try {
    const cityLike = await searchCitiesSweden(q);
    if (cityLike[0]) return { lat: cityLike[0].lat, lon: cityLike[0].lon };
  } catch {
    // no-op
  }

  return null;
}

function MeetingPointPicker(props: {
  lat?: number;
  lon?: number;
  onPick: (lat: number, lon: number) => void;
}) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  let map: import("leaflet").Map | null = null;
  let marker: import("leaflet").Marker | null = null;

  createEffect(() => {
    const el = mapRef();
    if (!el || map || typeof window === "undefined") return;

    let disposed = false;
    void (async () => {
      await import("leaflet/dist/leaflet.css");
      const L = await import("leaflet");
      if (disposed || !el || map) return;

      const defaultLat = typeof props.lat === "number" ? props.lat : 59.3293;
      const defaultLon = typeof props.lon === "number" ? props.lon : 18.0686;

      map = L.map(el).setView([defaultLat, defaultLon], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      marker = L.marker([defaultLat, defaultLon], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        if (!marker) return;
        const point = marker.getLatLng();
        props.onPick(point.lat, point.lng);
      });

      map.on("click", (ev: { latlng: { lat: number; lng: number } }) => {
        marker?.setLatLng(ev.latlng);
        props.onPick(ev.latlng.lat, ev.latlng.lng);
      });
    })();

    onCleanup(() => {
      disposed = true;
    });
  });

  createEffect(() => {
    if (!map || !marker) return;
    if (typeof props.lat !== "number" || typeof props.lon !== "number") return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - props.lat) < 0.00001 && Math.abs(current.lng - props.lon) < 0.00001) return;
    marker.setLatLng([props.lat, props.lon]);
    map.panTo([props.lat, props.lon], { animate: true });
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
      marker = null;
    }
  });

  return <div ref={setMapRef} class="excursions-picker-map" />;
}

export default function ExcursionsPage() {
  const [creating, setCreating] = createSignal(false);
  const [selectedExcursionId, setSelectedExcursionId] = createSignal<string | null>(null);
  const [commentBody, setCommentBody] = createSignal("");
  const [commentParentId, setCommentParentId] = createSignal<string>("");
  const [submittingComment, setSubmittingComment] = createSignal(false);
  const [submittingInterest, setSubmittingInterest] = createSignal(false);
  const [listError, setListError] = createSignal<string>("");
  const [detailError, setDetailError] = createSignal<string>("");

  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [startAt, setStartAt] = createSignal(toDatetimeLocalAtThreePm());
  const [durationHours, setDurationHours] = createSignal(2);
  const [visibility, setVisibility] = createSignal<ExcursionVisibility>("public");
  const [meetingArea, setMeetingArea] = createSignal("");
  const [meetingResolvedArea, setMeetingResolvedArea] = createSignal("");
  const [meetingMapUrl, setMeetingMapUrl] = createSignal("");
  const [meetingLat, setMeetingLat] = createSignal<number | undefined>(undefined);
  const [meetingLon, setMeetingLon] = createSignal<number | undefined>(undefined);
  const [meetingResolveLoading, setMeetingResolveLoading] = createSignal(false);
  const [meetingSearchLoading, setMeetingSearchLoading] = createSignal(false);
  const [titleMode, setTitleMode] = createSignal<"auto" | "manual">("auto");
  const [titleModalOpen, setTitleModalOpen] = createSignal(false);
  const [manualTitleDraft, setManualTitleDraft] = createSignal("");
  let suppressNextAreaLookup = false;

  const [excursions, { refetch: refetchExcursions }] = createResource(async () => {
    try {
      setListError("");
      const me = pb.authStore.model?.id;
      const [excursionsRaw, interestsRaw, commentsRaw, usersRaw] = await Promise.all([
        pb.collection("excursions").getFullList<{
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
        }>({
          filter: 'status = "scheduled"',
          sort: "start_at",
        }),
        pb.collection("excursion_interests").getFullList<{ excursion: string; user: string }>(),
        pb.collection("excursion_comments").getFullList<{ excursion: string }>(),
        pb.collection("users").getFullList<{ id: string; name?: string }>(),
      ]);

      const now = Date.now();
      const userNameById = new Map(usersRaw.map((u) => [u.id, u.name ?? ""]));
      const interestCountByExcursion = new Map();
      const commentCountByExcursion = new Map();
      const interestedByMe = new Set<string>();

      for (const it of interestsRaw) {
        interestCountByExcursion.set(it.excursion, (interestCountByExcursion.get(it.excursion) ?? 0) + 1);
        if (me && it.user === me) interestedByMe.add(it.excursion);
      }
      for (const c of commentsRaw) {
        commentCountByExcursion.set(c.excursion, (commentCountByExcursion.get(c.excursion) ?? 0) + 1);
      }

      return excursionsRaw
        .filter((e) => {
          const t = new Date(e.start_at).getTime();
          return Number.isNaN(t) ? true : t >= now;
        })
        .map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          start_at: e.start_at,
          duration_hours: e.duration_hours,
          meeting_area: e.meeting_area,
          meeting_map_url: e.meeting_map_url,
          meeting_latitude: e.meeting_latitude,
          meeting_longitude: e.meeting_longitude,
          visibility: e.visibility,
          status: e.status,
          host_user: e.host_user,
          host_name: userNameById.get(e.host_user) || "Användare",
          interest_count: interestCountByExcursion.get(e.id) ?? 0,
          comment_count: commentCountByExcursion.get(e.id) ?? 0,
          viewer_interested: interestedByMe.has(e.id),
        })) as ExcursionListItem[];
    } catch (err) {
      const msg = parseApiError(err);
      setListError(msg);
      return [] as ExcursionListItem[];
    }
  });

  const [selectedDetail, { refetch: refetchSelectedDetail }] = createResource(
    selectedExcursionId,
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
          pb.collection("users").getFullList<{ id: string; name?: string }>(),
        ]);

        const userNameById = new Map(usersRaw.map((u) => [u.id, u.name ?? "Användare"]));
        const detail: ExcursionDetailResponse = {
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
        return detail;
      } catch (err) {
        const msg = parseApiError(err);
        setDetailError(msg);
        return null;
      }
    }
  );

  const sortedExcursions = createMemo(() => {
    const list = excursions() ?? [];
    return [...list].sort((a, b) => a.start_at.localeCompare(b.start_at));
  });

  const selectedComments = createMemo(() => {
    const detail = selectedDetail();
    if (!detail?.comments) return [];
    return [...detail.comments].sort((a, b) => (a.created ?? "").localeCompare(b.created ?? ""));
  });

  async function applyMeetingPoint(lat: number, lon: number) {
    setMeetingLat(lat);
    setMeetingLon(lon);
    setMeetingMapUrl(buildGoogleMapsUrl(lat, lon));
    setMeetingResolveLoading(true);
    try {
      const area = await reverseGeocodeArea(lat, lon);
      setMeetingResolvedArea(area);
      // Only seed the input when it's still empty.
      if (!meetingArea().trim()) {
        suppressNextAreaLookup = true;
        setMeetingArea(area);
      }
    } catch {
      setMeetingResolvedArea("Okänt område");
    } finally {
      setMeetingResolveLoading(false);
    }
  }

  createEffect(() => {
    const area = meetingArea().trim();
    if (!area) return;
    if (suppressNextAreaLookup) {
      suppressNextAreaLookup = false;
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setMeetingSearchLoading(true);
        try {
          const cityHint = (pb.authStore.model?.city as string | undefined) ?? undefined;
          const point = await forwardGeocodeArea(area, cityHint);
          if (!point) return;
          setMeetingLat(point.lat);
          setMeetingLon(point.lon);
          setMeetingMapUrl(buildGoogleMapsUrl(point.lat, point.lon));
        } finally {
          setMeetingSearchLoading(false);
        }
      })();
    }, 450);

    onCleanup(() => clearTimeout(timer));
  });

  createEffect(() => {
    const suggested = buildSuggestedTitle(meetingArea(), visibility(), durationHours());
    if (titleMode() === "auto" && title() !== suggested) setTitle(suggested);
  });

  function openTitleModal() {
    setManualTitleDraft(title().trim());
    setTitleModalOpen(true);
  }

  function saveManualTitle() {
    const next = manualTitleDraft().trim();
    if (!next) {
      showToast("Skriv en titel först.", "error");
      return;
    }
    setTitle(next);
    setTitleMode("manual");
    setTitleModalOpen(false);
  }

  function resetToAutoTitle() {
    setTitleMode("auto");
    setTitle(buildSuggestedTitle(meetingArea(), visibility(), durationHours()));
    showToast("Titeln är tillbaka på autogenererad.");
  }

  async function createExcursion() {
    if (!title().trim() || !startAt()) {
      showToast("Titel och starttid krävs.", "error");
      return;
    }
    if (!meetingArea().trim()) {
      showToast("Skriv område eller sätt en pin på kartan.", "error");
      return;
    }
    if (typeof meetingLat() !== "number" || typeof meetingLon() !== "number") {
      showToast("Kunde inte hitta platsen automatiskt. Prova att finjustera med kartpinnen.", "error");
      return;
    }
    setCreating(true);
    try {
      await pb.collection("excursions").create({
        title: title().trim(),
        description: description().trim() || undefined,
        meeting_area: meetingArea().trim(),
        meeting_map_url: meetingMapUrl() || undefined,
        meeting_latitude: meetingLat(),
        meeting_longitude: meetingLon(),
        start_at: new Date(startAt()).toISOString(),
        duration_hours: durationHours(),
        visibility: visibility(),
        status: "scheduled",
      });
      setTitleMode("auto");
      setTitle(buildSuggestedTitle(meetingArea(), visibility(), durationHours()));
      setDescription("");
      setStartAt(toDatetimeLocalAtThreePm());
      setDurationHours(2);
      setVisibility("public");
      showToast("Hundträff publicerad.");
      await refetchExcursions();
    } catch (err) {
      showToast(parseApiError(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleInterest() {
    const id = selectedExcursionId();
    if (!id) return;
    setSubmittingInterest(true);
    try {
      await pb.collection("excursion_interests").create({ excursion: id });
      showToast("Intresse registrerat.");
      await Promise.all([refetchExcursions(), refetchSelectedDetail()]);
    } catch (err) {
      showToast(parseApiError(err), "error");
    } finally {
      setSubmittingInterest(false);
    }
  }

  async function submitComment() {
    const id = selectedExcursionId();
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
      await Promise.all([refetchSelectedDetail(), refetchExcursions()]);
    } catch (err) {
      showToast(parseApiError(err), "error");
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <AppShell>
      <div class="container excursions-page">
        <div class="page-hero">
          <h1>Hundträffar</h1>
          <p style="margin: 0; color: var(--color-text-muted);">
            Planera hundpromenader och träffar med andra i Hundkrets.
          </p>
        </div>

        <section class="card excursions-form-card">
          <h2 style="margin-top: 0;">Skapa hundträff</h2>
          <div class="excursions-form-grid">
            <div class="form-group">
              <label for="excursion-title">
                {titleMode() === "auto" ? "Titel (autogenererad)" : "Titel (egenskriven)"}
              </label>
              <div class="excursions-title-input-wrap">
                <input id="excursion-title" type="text" value={title()} readOnly />
                <Show when={titleMode() === "auto"} fallback={
                  <button type="button" class="excursions-title-icon-btn excursions-title-icon-in-input" onClick={resetToAutoTitle} aria-label="Byt till autogenererad titel" title="Byt till autogenererad titel">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M3 2v6h6" />
                      <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
                      <path d="M21 22v-6h-6" />
                      <path d="M3 12a9 9 0 0 0 15 6.7L21 16" />
                    </svg>
                  </button>
                }>
                  <button type="button" class="excursions-title-icon-btn excursions-title-icon-in-input" onClick={openTitleModal} aria-label="Redigera titel" title="Redigera titel">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                </Show>
              </div>
            </div>
            <div class="form-group">
              <label for="excursion-description">Beskrivning (valfritt)</label>
              <p class="excursions-help-text">
                Skriv kort vad ni planerar: om ni tar en promenad, ungefär var ni går och hur långt.
                Nämn gärna också om ni vill ta en fika efteråt.
              </p>
              <textarea
                id="excursion-description"
                rows={3}
                placeholder="Exempel: Vi ses vid motionsspåret, går cirka 5 km i lugnt tempo och tar gärna en fika efter promenaden."
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label for="excursion-meeting-area">Mötesplats</label>
              <p class="excursions-help-text">
                Skriv först mötesplats. Kartan visas då automatiskt, och du finjusterar genom att flytta
                nålen tills den pekar rätt.
              </p>
              <input
                id="excursion-meeting-area"
                type="text"
                value={meetingArea()}
                onInput={(e) => setMeetingArea(e.currentTarget.value)}
                placeholder="T.ex. Slottskogen, Göteborg"
                style="margin-bottom: 0.5rem;"
              />
              <Show
                when={meetingArea().trim().length > 0}
                fallback={<p class="excursions-map-hidden-hint">Skriv en mötesplats för att visa kartan.</p>}
              >
                <div class="excursions-map-reveal">
                  <MeetingPointPicker lat={meetingLat()} lon={meetingLon()} onPick={applyMeetingPoint} />
                </div>
              </Show>
              <div class="excursions-meeting-meta">
                <Show when={typeof meetingLat() === "number" && typeof meetingLon() === "number"}>
                  <div class="excursions-coordinates-row">
                    <div>
                      <strong>Koordinater:</strong> {`(${meetingLat()!.toFixed(5)}, ${meetingLon()!.toFixed(5)})`}
                    </div>
                    <Show when={meetingMapUrl()}>
                      <a
                        href={meetingMapUrl()}
                        target="_blank"
                        rel="noreferrer"
                        class="excursions-maps-icon-link"
                        title="Öppna i Google Maps"
                        aria-label="Öppna i Google Maps"
                      >
                        <img src="https://maps.gstatic.com/favicon3.ico" alt="" width="18" height="18" />
                      </a>
                    </Show>
                  </div>
                </Show>
                <Show when={meetingArea().trim().length > 0 && meetingArea() !== "Vald plats"}>
                    <div>
                      <strong>Mötesplatsnamn:</strong> {meetingArea()}
                    </div>
                </Show>
                <Show when={meetingSearchLoading()}>
                  <div>Uppdaterar kartan från text...</div>
                </Show>
              </div>
            </div>
            <div class="form-group">
              <label for="excursion-start">Datum och tid</label>
              <input
                id="excursion-start"
                type="datetime-local"
                value={startAt()}
                onInput={(e) => setStartAt(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label for="excursion-duration">Hur lång tid</label>
              <select
                id="excursion-duration"
                value={String(durationHours())}
                onChange={(e) => setDurationHours(parseInt(e.currentTarget.value, 10) || 2)}
              >
                <option value="1">1 timme</option>
                <option value="2">2 timmar</option>
                <option value="3">3 timmar</option>
                <option value="4">4 timmar</option>
                <option value="6">6 timmar</option>
                <option value="8">8 timmar</option>
              </select>
            </div>
            <div class="form-group">
              <label for="excursion-visibility">Synlighet</label>
              <select
                id="excursion-visibility"
                class="input"
                value={visibility()}
                onChange={(e) => setVisibility(e.currentTarget.value as ExcursionVisibility)}
              >
                <option value="public">{visibilityLabels.public}</option>
                <option value="matched_only">{visibilityLabels.matched_only}</option>
                <option value="interested_by_me">{visibilityLabels.interested_by_me}</option>
              </select>
            </div>
            <div class="excursions-form-actions">
              <button type="button" class="btn" onClick={createExcursion} disabled={creating()}>
                {creating() ? "Publicerar..." : "Publicera hundträff"}
              </button>
            </div>
          </div>
        </section>

        <section class="card" style="padding: 1rem;">
          <h2 style="margin-top: 0;">Kommande hundträffar</h2>
          <Show when={listError()}>
            <p style="color: #dc2626; margin-top: 0;">Kunde inte ladda hundträffar: {listError()}</p>
          </Show>
          <Show when={!excursions.loading} fallback={<p>Laddar hundträffar...</p>}>
            <Show when={sortedExcursions().length > 0} fallback={<p>Inga kommande hundträffar ännu.</p>}>
              <div style="display: grid; gap: 0.75rem;">
                <For each={sortedExcursions()}>
                  {(item) => (
                    <A
                      href={`/app/excursions/${item.id}`}
                      class="card"
                      style="text-align: left; padding: 0.9rem; cursor: pointer; display: block; text-decoration: none; color: inherit;"
                    >
                      <strong>{item.title}</strong>
                      <div style="font-size: 0.95rem; color: var(--color-text-muted); margin-top: 0.25rem;">
                        {formatDate(item.start_at)} - {item.meeting_area}
                      </div>
                      <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                        {formatDuration(item.duration_hours)} - {visibilityLabels[item.visibility]} - {item.interest_count} intresserade - {item.comment_count} kommentarer
                      </div>
                    </A>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </section>

        <Show when={selectedDetail()}>
          {(detail) => (
            <section class="card" style="padding: 1rem;">
              <div style="display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start;">
                <div>
                  <h2 style="margin-top: 0;">{detail().item.title}</h2>
                  <p style="margin: 0 0 0.5rem; color: var(--color-text-muted);">
                    Arrangor: <A href={`/users/${detail().item.host_user}`}>{detail().item.host_name || "Anvandare"}</A>
                  </p>
                  <p style="margin: 0 0 0.5rem; color: var(--color-text-muted);">
                    {formatDate(detail().item.start_at)} - {detail().item.meeting_area}
                  </p>
                  <p style="margin: 0 0 0.5rem; color: var(--color-text-muted);">
                    Längd: {formatDuration(detail().item.duration_hours)}
                  </p>
                  <Show when={detail().item.meeting_map_url}>
                    <p style="margin: 0 0 0.5rem;">
                      <a href={detail().item.meeting_map_url} target="_blank" rel="noreferrer">
                        Öppna mötesplats i Google Maps
                      </a>
                    </p>
                  </Show>
                  <Show when={detail().item.description}>
                    <p style="margin: 0 0 0.5rem;">{detail().item.description}</p>
                  </Show>
                </div>
                <button type="button" class="btn btn-secondary" onClick={() => setSelectedExcursionId(null)}>
                  Stang
                </button>
              </div>

              <div style="margin: 1rem 0;">
                <button
                  type="button"
                  class="btn"
                  onClick={handleInterest}
                  disabled={submittingInterest() || detail().item.viewer_interested}
                >
                  {detail().item.viewer_interested ? "Du ar intresserad" : submittingInterest() ? "Sparar..." : "Jag ar intresserad"}
                </button>
              </div>

              <h3>Kommentarer</h3>
              <Show when={selectedComments().length > 0} fallback={<p>Inga kommentarer an.</p>}>
                <div style="display: grid; gap: 0.6rem;">
                  <For each={selectedComments()}>
                    {(comment) => (
                      <div class="card" style="padding: 0.65rem;">
                        <div style="font-size: 0.85rem; color: var(--color-text-muted);">
                          {comment.author_name || "Anvandare"} - {formatDate(comment.created)}
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
                    Svarar pa kommentar.
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
      <Show when={titleModalOpen()}>
        <div class="modal-backdrop" onClick={() => setTitleModalOpen(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style="margin-top: 0;">Skriv egen titel</h3>
            <p style="margin: 0 0 0.75rem; color: var(--color-text-muted);">
              När du sparar här påverkas titeln inte längre av ändringar i formuläret.
            </p>
            <div class="form-group" style="margin-bottom: 1rem;">
              <label for="manual-title-input">Titel</label>
              <input
                id="manual-title-input"
                type="text"
                value={manualTitleDraft()}
                onInput={(e) => setManualTitleDraft(e.currentTarget.value)}
                placeholder="Skriv en egen titel"
                autofocus
              />
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="button" class="btn" onClick={saveManualTitle}>
                Spara titel
              </button>
              <button type="button" class="btn btn-secondary" onClick={() => setTitleModalOpen(false)}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      </Show>
    </AppShell>
  );
}
