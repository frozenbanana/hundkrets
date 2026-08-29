import { createSignal, Show } from "solid-js";
import { INTEREST_VERIFICATION_MESSAGE } from "~/lib/interest";
import { pb } from "~/lib/pocketbase";
import { parseApiError } from "~/lib/errors";
import { showToast } from "~/lib/toast";

export function InterestModal(props: {
  target: { userId: string; userName?: string };
  message: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  isVerified?: boolean;
}) {
  const {
    target,
    message,
    onMessageChange,
    onClose,
    onSubmit,
    loading,
    isVerified = true,
  } = props;
  const [verificationLoading, setVerificationLoading] = createSignal(false);
  const [verificationSent, setVerificationSent] = createSignal(false);

  async function requestVerification() {
    const email = String(pb.authStore.model?.email ?? "").trim();
    if (!email) {
      showToast("Ingen e-postadress hittades för kontot.", "error");
      return;
    }
    setVerificationLoading(true);
    try {
      await pb.collection("users").requestVerification(email);
      setVerificationSent(true);
      showToast("Verifieringsmail skickat! Kolla din e-post.");
    } catch (err) {
      showToast(parseApiError(err), "error");
    } finally {
      setVerificationLoading(false);
    }
  }

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
        <Show
          when={isVerified}
          fallback={
            <div class="admin-message-banner admin-message-banner-warning" role="alert">
              <div class="admin-message-banner-content">
                <p class="admin-message-banner-text">{INTEREST_VERIFICATION_MESSAGE}</p>
                <button
                  type="button"
                  class="btn"
                  disabled={verificationLoading() || verificationSent()}
                  onClick={requestVerification}
                >
                  {verificationLoading()
                    ? "Skickar..."
                    : verificationSent()
                      ? "Verifieringsmail skickat"
                      : "Skicka nytt verifieringsmail"}
                </button>
              </div>
            </div>
          }
        >
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
        </Show>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" onClick={onClose}>
            Avbryt
          </button>
          <Show when={isVerified}>
            <button
              type="button"
              class="btn"
              disabled={loading}
              onClick={() => onSubmit()}
              data-umami-event="Send interest"
            >
              Skicka
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
