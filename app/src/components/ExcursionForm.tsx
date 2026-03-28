import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { geocodeMeetingArea } from "~/lib/geocode";
import { showToast } from "~/lib/toast";
import type { ExcursionVisibility } from "~/types";

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

export type ExcursionFormValues = {
  title: string;
  description?: string;
  meeting_area: string;
  meeting_map_url?: string;
  meeting_latitude: number;
  meeting_longitude: number;
  start_at: string;
  duration_hours: number;
  share_phone_with_attendees: boolean;
  /** If set, should be saved on current user profile before saving excursion. */
  profile_phone_to_save?: string;
  visibility: ExcursionVisibility;
};

export type ExcursionFormInitial = {
  id?: string;
  title?: string;
  description?: string;
  meeting_area?: string;
  meeting_map_url?: string;
  meeting_latitude?: number;
  meeting_longitude?: number;
  start_at?: string;
  duration_hours?: number;
  share_phone_with_attendees?: boolean;
  visibility?: ExcursionVisibility;
};

type Props = {
  mode: "create" | "edit";
  initial?: ExcursionFormInitial;
  onSubmit: (values: ExcursionFormValues) => Promise<void>;
  submitLabel?: string;
  submittingLabel?: string;
  cityHint?: string;
  currentUserPhone?: string;
};

function formatDuration(hours?: number) {
  if (typeof hours !== "number" || Number.isNaN(hours) || hours <= 0) return "2 timmar";
  const rounded = Number.isInteger(hours) ? hours : Number(hours.toFixed(1));
  return `${rounded} ${rounded === 1 ? "timme" : "timmar"}`;
}

function toDatetimeLocalDefaultStart(date = new Date()) {
  const now = new Date(date);
  now.setSeconds(0, 0);
  const d = new Date(now);
  d.setHours(15, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
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
  const best = await geocodeMeetingArea(area, cityHint ? { cityHint } : undefined);
  if (!best) return null;
  return { lat: best.lat, lon: best.lon };
}

function MeetingPointPicker(props: {
  lat?: number;
  lon?: number;
  onPick: (lat: number, lon: number) => void;
}) {
  const [mapRef, setMapRef] = createSignal<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = createSignal(false);
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
      setMapReady(true);
    })();

    onCleanup(() => {
      disposed = true;
    });
  });

  createEffect(() => {
    const lat = props.lat;
    const lon = props.lon;
    const ready = mapReady();
    if (!ready || !map || !marker) return;
    if (typeof lat !== "number" || typeof lon !== "number") return;
    const current = marker.getLatLng();
    if (Math.abs(current.lat - lat) < 0.00001 && Math.abs(current.lng - lon) < 0.00001) return;
    marker.setLatLng([lat, lon]);
    map.panTo([lat, lon], { animate: true });
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
      marker = null;
      setMapReady(false);
    }
  });

  return <div ref={setMapRef} class="excursions-picker-map" />;
}

export function ExcursionForm(props: Props) {
  const [submitting, setSubmitting] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [startAt, setStartAt] = createSignal(toDatetimeLocalDefaultStart());
  const [durationHours, setDurationHours] = createSignal(2);
  const [sharePhoneWithAttendees, setSharePhoneWithAttendees] = createSignal(false);
  const [profilePhoneInput, setProfilePhoneInput] = createSignal((props.currentUserPhone ?? "").trim());
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
  const [initializedFromInitial, setInitializedFromInitial] = createSignal(false);
  let suppressNextAreaLookup = false;

  createEffect(() => {
    const initial = props.initial;
    if (!initial || initializedFromInitial()) return;
    setTitle(initial.title ?? "");
    setDescription(initial.description ?? "");
    setStartAt(toDatetimeLocal(initial.start_at) || toDatetimeLocalDefaultStart());
    setDurationHours(initial.duration_hours ?? 2);
    setSharePhoneWithAttendees(!!initial.share_phone_with_attendees);
    setProfilePhoneInput((props.currentUserPhone ?? "").trim());
    setVisibility(initial.visibility ?? "public");
    setMeetingArea(initial.meeting_area ?? "");
    setMeetingMapUrl(initial.meeting_map_url ?? "");
    setMeetingLat(initial.meeting_latitude);
    setMeetingLon(initial.meeting_longitude);
    // Edit mode starts as manual so existing title doesn't get auto-overwritten.
    setTitleMode("manual");
    setInitializedFromInitial(true);
  });

  createEffect(() => {
    const suggested = buildSuggestedTitle(meetingArea(), visibility(), durationHours());
    if (titleMode() === "auto" && title() !== suggested) setTitle(suggested);
  });

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
          const point = await forwardGeocodeArea(area, props.cityHint);
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

  async function applyMeetingPoint(lat: number, lon: number) {
    setMeetingLat(lat);
    setMeetingLon(lon);
    setMeetingMapUrl(buildGoogleMapsUrl(lat, lon));
    setMeetingResolveLoading(true);
    try {
      const area = await reverseGeocodeArea(lat, lon);
      setMeetingResolvedArea(area);
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
    // Important: set mode first so auto-title effect never clobbers saved manual title.
    setTitleMode("manual");
    setTitle(next);
    setTitleModalOpen(false);
  }

  function resetToAutoTitle() {
    setTitleMode("auto");
    setTitle(buildSuggestedTitle(meetingArea(), visibility(), durationHours()));
    showToast("Titeln är tillbaka på autogenererad.");
  }

  async function submit() {
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

    const currentProfilePhone = (props.currentUserPhone ?? "").trim();
    const typedProfilePhone = profilePhoneInput().trim();
    const effectiveProfilePhone = currentProfilePhone || typedProfilePhone;
    if (sharePhoneWithAttendees() && !effectiveProfilePhone) {
      showToast("Lägg till telefonnummer för att kunna dela det med deltagare.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await props.onSubmit({
        title: title().trim(),
        description: description().trim() || undefined,
        meeting_area: meetingArea().trim(),
        meeting_map_url: meetingMapUrl() || undefined,
        meeting_latitude: meetingLat(),
        meeting_longitude: meetingLon(),
        start_at: new Date(startAt()).toISOString(),
        duration_hours: durationHours(),
        share_phone_with_attendees: sharePhoneWithAttendees(),
        profile_phone_to_save: !currentProfilePhone && typedProfilePhone ? typedProfilePhone : undefined,
        visibility: visibility(),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section class="card excursions-form-card">
        <h2 style="margin-top: 0;">{props.mode === "create" ? "Skapa hundträff" : "Redigera hundträff"}</h2>
        <div class="excursions-form-grid">
          <div class="form-group">
            <label for="excursion-title">
              {titleMode() === "auto" ? "Titel (autogenererad)" : "Titel (egenskriven)"}
            </label>
            <div class="excursions-title-input-wrap">
              <input
                id="excursion-title"
                type="text"
                value={title()}
                readOnly={titleMode() === "auto"}
                onInput={(e) => setTitle(e.currentTarget.value)}
              />
              <Show
                when={titleMode() === "auto"}
                fallback={
                  <button
                    type="button"
                    class="excursions-title-icon-btn excursions-title-icon-in-input"
                    onClick={resetToAutoTitle}
                    aria-label="Byt till autogenererad titel"
                    title="Byt till autogenererad titel"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M3 2v6h6" />
                      <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
                      <path d="M21 22v-6h-6" />
                      <path d="M3 12a9 9 0 0 0 15 6.7L21 16" />
                    </svg>
                  </button>
                }
              >
                <button
                  type="button"
                  class="excursions-title-icon-btn excursions-title-icon-in-input"
                  onClick={openTitleModal}
                  aria-label="Redigera titel"
                  title="Redigera titel"
                >
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
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
            />
          </div>

          <div class="form-group">
            <label for="excursion-meeting-area">Mötesplats</label>
            <p class="excursions-help-text">
              Skriv först mötesplats. Kartan visas då automatiskt, och du finjusterar genom att flytta nålen tills den pekar rätt.
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
                    <a href={meetingMapUrl()} target="_blank" rel="noreferrer" class="excursions-maps-icon-link" title="Öppna i Google Maps" aria-label="Öppna i Google Maps">
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
              <Show when={meetingSearchLoading() || meetingResolveLoading()}>
                <div>Uppdaterar kartan från text...</div>
              </Show>
              <Show when={meetingResolvedArea() && meetingResolvedArea() !== meetingArea()}>
                <div>
                  <strong>Föreslaget område:</strong> {meetingResolvedArea()}
                </div>
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
            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <input
                type="checkbox"
                checked={sharePhoneWithAttendees()}
                onChange={(e) => setSharePhoneWithAttendees(e.currentTarget.checked)}
              />
              Dela med dig av ditt telefonnummer för de som kommer
            </label>
            <Show when={sharePhoneWithAttendees()}>
              <Show
                when={(props.currentUserPhone ?? "").trim().length > 0}
                fallback={
                  <>
                    <p class="excursions-help-text" style="margin-top: 0;">
                      Du har inget telefonnummer i profilen. Fyll i det här så sparas det till din profil vid publicering.
                    </p>
                    <input
                      type="tel"
                      value={profilePhoneInput()}
                      onInput={(e) => setProfilePhoneInput(e.currentTarget.value)}
                      placeholder="Telefonnummer"
                    />
                  </>
                }
              >
                <p class="excursions-help-text" style="margin: 0;">
                  Telefon från din profil delas med deltagare: <strong>{props.currentUserPhone}</strong>
                </p>
              </Show>
            </Show>
          </div>

          <div class="form-group">
            <label for="excursion-visibility">Synlighet</label>
            <select
              id="excursion-visibility"
              class="input"
              value={visibility()}
              onChange={(e) => setVisibility(e.currentTarget.value as ExcursionVisibility)}
            >
              <option value="public">Publik</option>
              <option value="matched_only">Ömsesidigt matchade</option>
              <option value="interested_by_me">De jag visat intresse för</option>
            </select>
          </div>

          <div class="excursions-form-actions">
            <button type="button" class="btn" onClick={submit} disabled={submitting()}>
              {submitting()
                ? props.submittingLabel ?? "Sparar..."
                : props.submitLabel ?? (props.mode === "create" ? "Publicera hundträff" : "Spara ändringar")}
            </button>
          </div>
        </div>
      </section>

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
    </>
  );
}
