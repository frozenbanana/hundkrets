import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { setOnboardingUserType } from "~/lib/onboarding";
import { OnboardingShell } from "~/components/OnboardingShell";

export default function OnboardingChoice() {
  const nav = useNavigate();

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
    if (done) {
      nav("/app/matches", { replace: true });
      return;
    }
  });

  function handleChoice(type: "has_dogs" | "sitter_only") {
    setOnboardingUserType(type);
    nav("/onboarding/profile");
  }

  return (
    <OnboardingShell step={1} totalSteps={1} title="Vad vill du göra?" backHref="history">
      <div class="card">
        <p style="color: var(--color-text); margin-bottom: 1.5rem;">
          Välj hur du vill använda Hundkrets. Du kan alltid ändra senare.
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button
            type="button"
            class="btn"
            onClick={() => handleChoice("has_dogs")}
            style="text-align: left; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem;"
          >
            <span style="font-size: 2rem;">🐕</span>
            <div>
              <strong>Jag har hund/hundar</strong>
              <p style="margin: 0.25rem 0 0; font-size: 0.9rem; font-weight: normal; color: #d4c4b0;">
                Jag vill byta hundpassning med andra i mitt område
              </p>
            </div>
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => handleChoice("sitter_only")}
            style="text-align: left; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 1rem;"
          >
            <span style="font-size: 2rem;">🏠</span>
            <div>
              <strong>Jag vill bara passa hundar</strong>
              <p style="margin: 0.25rem 0 0; font-size: 0.9rem; font-weight: normal; color: #d4c4b0;">
                Jag har inte hund men vill passa andras hundar
              </p>
            </div>
          </button>
        </div>
      </div>
    </OnboardingShell>
  );
}
