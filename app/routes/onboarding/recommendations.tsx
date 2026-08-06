import { A, useNavigate } from "@solidjs/router";
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
      title="Skicka ditt första intresse"
      nextStepHint="När någon svarar kan ni chatta och planera passning"
      backHref={isSitterOnly() ? "/onboarding/capacity" : isReceiverOnly() ? "/onboarding/needs" : "/onboarding/capacity"}
    >
      <div class="card">
        <p style="margin: 0 0 1rem; color: var(--color-text-muted);">
          Här är grannar som passar dig. Skicka intresse till minst en—det är så Hundkrets kommer igång.
        </p>
        <RecommendedMembersSection profileFrom="onboarding" />
        <div style="margin-top: 1.25rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
          <A href="/app/explore" class="btn">
            Fortsätt till Utforska
          </A>
        </div>
      </div>
    </OnboardingShell>
  );
}
