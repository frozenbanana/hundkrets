import { createEffect, createSignal, onCleanup, Show } from "solid-js";

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
}

export function ImageCaptureInput(props: ImageCaptureInputProps) {
  const [blobUrl, setBlobUrl] = createSignal<string | undefined>();
  const [isDragging, setIsDragging] = createSignal(false);

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
    if (file && isImageFile(file)) props.onInput(file);
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

  return (
    <div class="form-group">
      <label for={props.id}>{props.label}</label>
      <div
        class="image-capture-row"
        classList={{ "image-capture-dragging": isDragging() }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Show when={previewUrl()}>
          <div
            class="image-capture-preview"
            classList={{ "image-capture-preview-rect": props.previewShape === "rect" }}
          >
            <img src={previewUrl()!} alt="Preview" />
          </div>
        </Show>
        <div class="image-capture-actions">
          <input
            id={props.id}
            type="file"
            accept="image/*"
            capture={props.capture}
            onInput={(e) => props.onInput(e.currentTarget.files?.[0] ?? null)}
          />
          {props.hint && (
            <p class="image-capture-hint">{props.hint}</p>
          )}
          {isDragging() && (
            <p class="image-capture-drop-hint">{props.dropHint ?? "Släpp bilden här"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
