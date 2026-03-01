import { A, useNavigate } from "@solidjs/router";
import { Show } from "solid-js";
import { UnverifiedBanner } from "~/components/UnverifiedBanner";

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
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
  return (
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
        <span class="paw-emoji">🐕</span>
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
      {props.children}
    </div>
  );
}
