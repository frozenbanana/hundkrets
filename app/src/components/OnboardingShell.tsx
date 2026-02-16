import { A } from "@solidjs/router";

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
  children: import("solid-js").JSX.Element;
}

export function OnboardingShell(props: OnboardingShellProps) {
  return (
    <div class="container">
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
