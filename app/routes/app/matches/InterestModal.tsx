import { Show } from "solid-js";

export function InterestModal(props: {
  target: { userId: string; userName?: string };
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const { target, message, onMessageChange, onClose, onSubmit, loading } = props;
  return (
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interest-modal-title"
      onClick={onClose}
    >
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <h2 id="interest-modal-title" style="margin: 0;">
            Skicka intresseförfrågan
          </h2>
          <button type="button" class="match-detail-close" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </div>
        <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
          {target.userName
            ? `Skriv ett meddelande till ${target.userName} (valfritt):`
            : "Skriv ett meddelande (valfritt):"}
        </p>
        <div class="form-group">
          <label for="interest-message">Meddelande</label>
          <textarea
            id="interest-message"
            placeholder="T.ex. Hej! Jag är intresserad av att byta hundpassning..."
            value={message}
            onInput={(e) => onMessageChange(e.currentTarget.value)}
            rows={4}
            maxLength={500}
            style="resize: vertical;"
          />
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <button type="button" class="btn" disabled={loading} onClick={() => onSubmit()}>
            Skicka
          </button>
        </div>
      </div>
    </div>
  );
}
