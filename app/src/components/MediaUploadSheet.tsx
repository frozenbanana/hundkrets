import { Show } from "solid-js";
import { VideoCaptureInput } from "~/components/VideoCaptureInput";

export function MediaUploadSheet(props: {
  open: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}) {
  return (
    <Show when={props.open}>
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="media-upload-title" onClick={props.onClose}>
        <div class="modal media-upload-sheet" onClick={(e) => e.stopPropagation()}>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <h2 id="media-upload-title" style="margin: 0;">
              Ladda upp video
            </h2>
            <button type="button" class="match-detail-close" onClick={props.onClose} aria-label="Stäng">
              ×
            </button>
          </div>
          <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
            Kort klipp av din hund (max 15 sekunder). Ljud är avstängt i flödet.
          </p>
          <VideoCaptureInput
            compact
            onUploaded={() => {
              props.onUploaded?.();
              props.onClose();
            }}
          />
        </div>
      </div>
    </Show>
  );
}
