import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";

export default function OnboardingIndex() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    nav(pb.authStore.model?.area ? "/app/matches" : "/onboarding/profile", { replace: true });
  });

  return null;
}
