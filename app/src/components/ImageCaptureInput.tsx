import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { MAX_IMAGE_SIZE_BYTES } from "~/lib/errors";

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

interface ImageCaptureInputProps {
  id: string;
  label: string;
  /** "user" for front camera (selfie), "environment" for rear camera (photos of things) */
  capture?: "user" | "environment";
  value: File | null;
  onInput: (file: File | null) => void;
  /** Optional preview URL for existing image (e.g. from PocketBase) */
  existingUrl?: string;
  /** Hint text shown below input */
  hint?: string;
  /** Text shown when dragging over (default: "Släpp bilden här") */
  dropHint?: string;
  /** "circle" for avatar, "rect" for dog/photo */
  previewShape?: "circle" | "rect";
  /** "profile" = centered card layout with styled button, for profile picture */
  variant?: "default" | "profile";
  /** Max file size in bytes (default 5 MB). Validates before accepting. */
  maxSize?: number;
}

export function ImageCaptureInput(props: ImageCaptureInputProps) {
  const [blobUrl, setBlobUrl] = createSignal<string | undefined>();
  const [isDragging, setIsDragging] = createSignal(false);
  const [sizeError, setSizeError] = createSignal("");
  const maxSize = () => props.maxSize ?? MAX_IMAGE_SIZE_BYTES;

  function validateAndAccept(file: File | null) {
    setSizeError("");
    if (!file) {
      props.onInput(null);
      return;
    }
    if (file.size > maxSize()) {
      setSizeError("Filen är för stor. Max 5 MB.");
      props.onInput(null);
      return;
    }
    props.onInput(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && isImageFile(file)) validateAndAccept(file);
  }

  let lastBlobUrl: string | undefined;
  createEffect(() => {
    const f = props.value;
    if (lastBlobUrl) {
      URL.revokeObjectURL(lastBlobUrl);
      lastBlobUrl = undefined;
    }
    if (f) {
      lastBlobUrl = URL.createObjectURL(f);
      setBlobUrl(lastBlobUrl);
    } else {
      setBlobUrl(undefined);
    }
  });

  onCleanup(() => {
    if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  });

  const previewUrl = () => blobUrl() ?? props.existingUrl;
  const isProfile = () => props.variant === "profile";

  return (
    <div class="form-group" classList={{ "image-capture-profile": isProfile() }}>
      <label for={props.id}>{props.label}</label>
      <div
        class="image-capture-row"
        classList={{
          "image-capture-dragging": isDragging(),
          "image-capture-profile-row": isProfile(),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label
          for={props.id}
          class="image-capture-preview"
          classList={{
            "image-capture-preview-rect": props.previewShape === "rect",
            "image-capture-preview-profile": isProfile(),
            "image-capture-preview-clickable": isProfile(),
          }}
        >
          <Show when={previewUrl()} fallback={
            <div class="image-capture-placeholder">
              <span class="image-capture-placeholder-icon">📷</span>
              <span class="image-capture-placeholder-text">{isProfile() ? "Lägg till foto" : "Välj bild"}</span>
            </div>
          }>
            <img src={previewUrl()!} alt="Preview" />
          </Show>
          {previewUrl() && (
            <>
              {isProfile() && (
                <span class="image-capture-overlay">
                  <span class="image-capture-overlay-text">Byt foto</span>
                </span>
              )}
              <span class="image-capture-replace-hint">{isProfile() ? "Tryck för att byta" : "Klicka eller släpp ny bild"}</span>
            </>
          )}
        </label>
        <div class="image-capture-actions" classList={{ "image-capture-actions-profile": isProfile() }}>
          <input
            id={props.id}
            type="file"
            accept="image/*"
            capture={props.capture ?? (isProfile() ? "user" : undefined)}
            class="image-capture-input"
            onInput={(e) => props.onInput(e.currentTarget.files?.[0] ?? null)}
          />
          {!isProfile() && (
            <label for={props.id} class="image-capture-btn">
              Välj bild
            </label>
          )}
          {props.hint && (
            <p class="image-capture-hint">{props.hint}</p>
          )}
          {sizeError() && (
            <p class="form-error" role="alert" style="margin-top: 0.5rem;">{sizeError()}</p>
          )}
          {isDragging() && (
            <p class="image-capture-drop-hint">{props.dropHint ?? "Släpp bilden här"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
