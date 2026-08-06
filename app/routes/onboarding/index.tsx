import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { isOnboardingDone } from "~/lib/onboarding";

export default function OnboardingIndex() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    nav(isOnboardingDone(m) ? "/app/explore" : "/onboarding/choice", { replace: true });
  });

  return null;
}
