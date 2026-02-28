export function RespondModal(props: {
  target: { requestId: string; fromUserId: string; fromUserName?: string };
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  const { target, message, onMessageChange, onClose, onAccept, onReject, loading } = props;
  return (
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="respond-modal-title"
      onClick={onClose}
    >
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <h2 id="respond-modal-title" style="margin: 0;">
            Svara på förfrågan
          </h2>
          <button type="button" class="match-detail-close" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </div>
        <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
          {target.fromUserName
            ? `Skriv ett svar till ${target.fromUserName} (valfritt):`
            : "Skriv ett svar (valfritt):"}
        </p>
        <div class="form-group">
          <label for="respond-message">Meddelande</label>
          <textarea
            id="respond-message"
            placeholder="T.ex. Hej! Jag är också intresserad av att byta hundpassning..."
            value={message}
            onInput={(e) => onMessageChange(e.currentTarget.value)}
            rows={4}
            maxLength={500}
            style="resize: vertical;"
          />
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" disabled={loading} onClick={onReject}>
            Avvisa
          </button>
          <button type="button" class="btn" disabled={loading} onClick={() => onAccept()}>
            Acceptera
          </button>
        </div>
      </div>
    </div>
  );
}
