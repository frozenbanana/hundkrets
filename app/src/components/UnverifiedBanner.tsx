import { createSignal, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { authVersion } from "~/lib/authStore";
import { parseApiError } from "~/lib/errors";
import { showToast } from "~/lib/toast";

export function UnverifiedBanner() {
  authVersion(); // Re-render when auth is refreshed
  const show = () =>
    pb.authStore.isValid && (pb.authStore.model as { verified?: boolean } | null)?.verified !== true;

  const [resendLoading, setResendLoading] = createSignal(false);

  async function handleResendVerification() {
    const email = (pb.authStore.model?.email as string) ?? "";
    if (!email) return;
    setResendLoading(true);
    try {
      await pb.collection("users").requestVerification(email);
      showToast("Verifieringsmail skickat! Kolla din e-post.");
    } catch (err: unknown) {
      showToast(parseApiError(err), "error");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <Show when={show()}>
      <section
        class="admin-message-banner admin-message-banner-warning"
        role="status"
        aria-live="polite"
      >
        <div class="admin-message-banner-content">
          <p class="admin-message-banner-text">
            Du är inte verifierad än. Du kommer inte kunna skicka intresseanmälningar eller svara
            på förfrågningar. För att verifiera dig, klicka på länken i det verifieringsmail vi
            skickade till din e-post.{" "}
            <button
              type="button"
              class="unverified-banner-link"
              disabled={resendLoading()}
              onClick={handleResendVerification}
            >
              {resendLoading() ? "Skickar..." : "Skicka nytt verifieringsmail"}
            </button>
          </p>
        </div>
      </section>
    </Show>
  );
}
