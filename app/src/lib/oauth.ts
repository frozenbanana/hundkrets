import { pb } from "~/lib/pocketbase";

/**
 * After OAuth login, redirect based on onboarding status.
 */
export function handleOAuthRedirect(nav: (path: string) => void): void {
  const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
  const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
  nav(done ? "/app/explore" : "/onboarding/choice", { replace: true });
}
