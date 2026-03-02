/** User type chosen at start of onboarding. Stored in sessionStorage for the duration of onboarding. */
export type OnboardingUserType = "has_dogs" | "sitter_only" | "receiver_only";

const KEY = "onboarding_user_type";

export function getOnboardingUserType(): OnboardingUserType | null {
  if (typeof sessionStorage === "undefined") return null;
  const v = sessionStorage.getItem(KEY);
  if (v === "has_dogs" || v === "sitter_only" || v === "receiver_only") return v;
  return null;
}

export function setOnboardingUserType(t: OnboardingUserType): void {
  sessionStorage.setItem(KEY, t);
}

export function clearOnboardingUserType(): void {
  sessionStorage.removeItem(KEY);
}

export function isSitterOnly(): boolean {
  return getOnboardingUserType() === "sitter_only";
}

/** User who only wants to receive dog sitting (skips capacity step). */
export function isReceiverOnly(): boolean {
  return getOnboardingUserType() === "receiver_only";
}
