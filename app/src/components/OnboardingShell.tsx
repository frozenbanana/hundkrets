import { A, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { UnverifiedBanner } from "~/components/UnverifiedBanner";

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
  /** Kort beskrivning av nästa steg, t.ex. "Nästa: Lägg till dina hundar" */
  nextStepHint?: string;
  /** When set, shows a "Tillbaka" link. Use a path for previous step, or "history" to use browser history (nav(-1)). */
  backHref?: string;
  children: import("solid-js").JSX.Element;
}

export function OnboardingShell(props: OnboardingShellProps) {
  const nav = useNavigate();
  const showBack = () => !!props.backHref;
  const handleBack = () => {
    if (props.backHref === "history") nav(-1);
    else if (props.backHref) nav(props.backHref);
  };
  function logout() {
    pb.authStore.clear();
    nav("/", { replace: true });
  }
  return (
    <div>
      <header class="onboarding-header">
        <div class="onboarding-header-inner container">
          <A href="/" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem;">
            <img src="/logo-icon.png" alt="Hundkrets" width="28" height="28" style="border-radius: 6px;" />
            Hundkrets
          </A>
          <button type="button" class="btn btn-secondary" onClick={logout}>
            Logga ut
          </button>
        </div>
      </header>
      <div class="container">
        <UnverifiedBanner />
        <Show when={showBack()}>
          {props.backHref === "history" ? (
            <button type="button" class="onboarding-back" onClick={handleBack} style="display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; background: none; border: none; color: var(--color-text-muted); font-size: 0.95rem; cursor: pointer; padding: 0;">
              ← Tillbaka
            </button>
          ) : (
            <A href={props.backHref!} class="onboarding-back" style="display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: var(--color-text-muted); text-decoration: none; font-size: 0.95rem;">
              ← Tillbaka
            </A>
          )}
        </Show>
        <div class="page-hero">
          <h1>{props.title}</h1>
        </div>
        <div class="onboarding-progress">
          {Array.from({ length: props.totalSteps }, (_, i) => (
            <div
              class={`step ${i + 1 === props.step ? "active" : ""} ${i + 1 < props.step ? "done" : ""}`}
              aria-current={i + 1 === props.step ? "step" : undefined}
            />
          ))}
        </div>
        <p class="onboarding-progress-label" aria-live="polite">
          Steg {props.step} av {props.totalSteps}
        </p>
        {props.nextStepHint && (
          <p class="onboarding-next-hint">
            {props.nextStepHint}
          </p>
        )}
        {props.children}
      </div>
    </div>
  );
}
