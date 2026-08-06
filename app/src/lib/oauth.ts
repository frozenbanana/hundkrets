import { pb } from "~/lib/pocketbase";
import { isOnboardingDone } from "~/lib/onboarding";

/**
 * After OAuth login, redirect based on onboarding status.
 */
export function handleOAuthRedirect(nav: (path: string) => void): void {
  if (!pb?.authStore?.isValid) {
    nav("/login", { replace: true });
    return;
  }
  const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
  nav(isOnboardingDone(m) ? "/app/explore" : "/onboarding/choice", { replace: true });
}
