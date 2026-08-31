import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import {
  createMediaRecord,
  extractVideoPoster,
  MAX_VIDEO_DURATION_MS,
  MAX_VIDEO_SIZE_BYTES,
  type MediaVisibility,
} from "~/lib/media";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

interface VideoCaptureInputProps {
  /** Called after a media record is created successfully */
  onUploaded?: () => void;
  /** Compact mode for FAB sheet / onboarding */
  compact?: boolean;
  /** Upload immediately after pick/record (onboarding) */
  autoUpload?: boolean;
}

export function VideoCaptureInput(props: VideoCaptureInputProps) {
  const [file, setFile] = createSignal<File | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string>();
  const [visibility, setVisibility] = createSignal<MediaVisibility>("public");
  const [recording, setRecording] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [elapsedMs, setElapsedMs] = createSignal(0);

  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let timer: number | undefined;
  let videoPreviewEl: HTMLVideoElement | undefined;

  createEffect(() => {
    const f = file();
    if (previewUrl()) URL.revokeObjectURL(previewUrl()!);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(undefined);
  });

  onCleanup(() => {
    stopRecording(true);
    if (previewUrl()) URL.revokeObjectURL(previewUrl()!);
  });

  function acceptFile(f: File | null) {
    setError("");
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("video/")) {
      setError("Välj en videofil.");
      return;
    }
    if (f.size > MAX_VIDEO_SIZE_BYTES) {
      setError("Videon är för stor (max 25 MB).");
      return;
    }
    setFile(f);
    if (props.autoUpload) {
      void uploadFile(f);
    }
  }

  async function uploadFile(f: File) {
    setLoading(true);
    setError("");
    try {
      const { poster, durationMs, width, height } = await extractVideoPoster(f);
      await createMediaRecord({
        file: f,
        kind: "video",
        visibility: visibility(),
        posterFile: poster,
        durationMs,
        width,
        height,
        contentType: f.type || "video/webm",
      });
      showToast("Videon är uppladdad");
      setFile(null);
      props.onUploaded?.();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    setError("");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      if (videoPreviewEl) {
        videoPreviewEl.srcObject = stream;
        await videoPreviewEl.play().catch(() => {});
      }
      chunks = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || "video/webm" });
        const f = new File([blob], `clip-${Date.now()}.webm`, { type: blob.type });
        acceptFile(f);
        stopTracks();
      };
      mediaRecorder.start(200);
      setRecording(true);
      setElapsedMs(0);
      const started = Date.now();
      timer = window.setInterval(() => {
        const ms = Date.now() - started;
        setElapsedMs(ms);
        if (ms >= MAX_VIDEO_DURATION_MS) stopRecording(false);
      }, 200);
    } catch {
      setError("Kunde inte starta kameran. Tillåt kamera/mikrofon eller välj från galleri.");
      stopTracks();
    }
  }

  function stopTracks() {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (videoPreviewEl) videoPreviewEl.srcObject = null;
  }

  function stopRecording(discard: boolean) {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      if (discard) {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = () => stopTracks();
      }
      try {
        mediaRecorder.stop();
      } catch {
        stopTracks();
      }
    } else {
      stopTracks();
    }
    mediaRecorder = null;
    setRecording(false);
  }

  async function handleUpload() {
    const f = file();
    if (!f) return;
    await uploadFile(f);
  }

  const secs = () => Math.min(15, Math.ceil(elapsedMs() / 1000));

  return (
    <div class="video-capture" classList={{ "video-capture-compact": props.compact }}>
      <Show when={error()}>
        <p class="form-error" role="alert">
          {error()}
        </p>
      </Show>

      <Show when={recording()}>
        <div class="video-capture-live">
          <video ref={(el) => (videoPreviewEl = el)} muted playsinline class="video-capture-preview" />
          <div class="video-capture-timer">{secs()}s / 15s</div>
          <button type="button" class="btn" onClick={() => stopRecording(false)}>
            Stoppa
          </button>
        </div>
      </Show>

      <Show when={!recording()}>
        <Show when={previewUrl()}>
          <video src={previewUrl()} class="video-capture-preview" controls muted playsinline />
        </Show>
        <div class="video-capture-actions">
          <label class="btn btn-secondary video-capture-file-btn">
            Välj från galleri
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => acceptFile(e.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <button type="button" class="btn btn-secondary" onClick={startRecording}>
            Spela in
          </button>
        </div>
        <div class="form-group" style="margin-top: 0.75rem;">
          <label for="media-visibility">Synlighet</label>
          <select
            id="media-visibility"
            value={visibility()}
            onInput={(e) => setVisibility(e.currentTarget.value as MediaVisibility)}
          >
            <option value="public">Offentlig</option>
            <option value="members">Endast medlemmar</option>
          </select>
        </div>
        <Show when={!props.autoUpload || !!file() || loading()}>
          <button
            type="button"
            class="btn"
            style="width: 100%; margin-top: 0.5rem;"
            disabled={!file() || loading()}
            onClick={handleUpload}
            data-umami-event="Upload dog video"
          >
            {loading() ? "Laddar upp…" : props.autoUpload ? "Försök igen" : "Ladda upp (max 15 s)"}
          </button>
        </Show>
      </Show>
    </div>
  );
}
