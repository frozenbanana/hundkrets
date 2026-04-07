import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { OnboardingShell } from "~/components/OnboardingShell";
import { RecommendedMembersSection } from "~/components/RecommendedMembersSection";
import { clearOnboardingUserType, getOnboardingUserType, isReceiverOnly, isSitterOnly } from "~/lib/onboarding";
import { pb } from "~/lib/pocketbase";

export default function OnboardingRecommendations() {
  const nav = useNavigate();

  async function markOnboardingComplete() {
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    const userType = getOnboardingUserType();
    const update: Record<string, unknown> = { onboarding_complete: true };
    if (userType) update.user_type = userType;
    await pb.collection("users").update(userId, update);
    pb.authStore.save(pb.authStore.token!, {
      ...pb.authStore.model,
      ...update,
    });
    clearOnboardingUserType();
  }

  onMount(async () => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    await markOnboardingComplete();
  });

  return (
    <OnboardingShell
      step={isSitterOnly() ? 3 : isReceiverOnly() ? 4 : 5}
      totalSteps={isSitterOnly() ? 3 : isReceiverOnly() ? 4 : 5}
      title="Dina rekommendationer"
      nextStepHint="Nästa: Utforska fler medlemmar"
      backHref={isSitterOnly() ? "/onboarding/capacity" : isReceiverOnly() ? "/onboarding/needs" : "/onboarding/capacity"}
    >
      <div class="card">
        <RecommendedMembersSection profileFrom="onboarding" />
      </div>
    </OnboardingShell>
  );
}
