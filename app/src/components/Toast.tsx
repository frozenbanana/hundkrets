import { For } from "solid-js";
import { getToasts, dismissToast } from "~/lib/toast";

export function ToastContainer() {
  const toasts = getToasts();

  return (
    <div class="toast-container" aria-live="polite" aria-label="Meddelanden">
      <For each={toasts()}>
        {(t) => (
          <div
            class={`toast toast-${t.type}`}
            role="alert"
            onClick={() => dismissToast(t.id)}
          >
            {t.type === "success" && <span class="toast-icon" aria-hidden>✓</span>}
            {t.type === "error" && <span class="toast-icon toast-icon-error" aria-hidden>!</span>}
            <span>{t.text}</span>
          </div>
        )}
      </For>
    </div>
  );
}
