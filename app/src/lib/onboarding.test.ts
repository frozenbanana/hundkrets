import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isOnboardingDone, pathAfterCapacity, pathAfterNeeds } from "./onboarding";

describe("isOnboardingDone", () => {
  it("treats an explicit unfinished member as unfinished even when area is saved", () => {
    expect(isOnboardingDone({ onboarding_complete: false, area: "Karlskrona" })).toBe(false);
    expect(isOnboardingDone({ onboarding_complete: false, area: "" })).toBe(false);
    expect(isOnboardingDone({ onboarding_complete: false })).toBe(false);
  });

  it("treats an explicit finished member as finished", () => {
    expect(isOnboardingDone({ onboarding_complete: true, area: "Karlskrona" })).toBe(true);
    expect(isOnboardingDone({ onboarding_complete: true, area: "" })).toBe(true);
    expect(isOnboardingDone({ onboarding_complete: true })).toBe(true);
  });

  it("uses area only for legacy records where onboarding_complete is missing", () => {
    expect(isOnboardingDone({ area: "Karlskrona" })).toBe(true);
    expect(isOnboardingDone({ onboarding_complete: null, area: "  Lyckeby " })).toBe(true);
    expect(isOnboardingDone({ area: "   " })).toBe(false);
    expect(isOnboardingDone({ onboarding_complete: null, area: "" })).toBe(false);
    expect(isOnboardingDone({})).toBe(false);
    expect(isOnboardingDone(null)).toBe(false);
    expect(isOnboardingDone(undefined)).toBe(false);
  });
});

describe("path to recommendations", () => {
  it("sends needs skip and continue to recommendations for receivers and capacity otherwise", () => {
    expect(pathAfterNeeds(true)).toBe("/onboarding/recommendations");
    expect(pathAfterNeeds(false)).toBe("/onboarding/capacity");
  });

  it("sends capacity skip and continue to recommendations", () => {
    expect(pathAfterCapacity()).toBe("/onboarding/recommendations");
  });

  it("wires the needs and capacity screens to those paths instead of Explore", () => {
    const needs = readFileSync(resolve(process.cwd(), "routes/onboarding/needs.tsx"), "utf8");
    const capacity = readFileSync(resolve(process.cwd(), "routes/onboarding/capacity.tsx"), "utf8");
    const recommendations = readFileSync(
      resolve(process.cwd(), "src/components/RecommendedMembersSection.tsx"),
      "utf8"
    );

    const needsSkip = needs.slice(needs.indexOf("async function handleSkip"), needs.indexOf("const hasDogs"));
    const capacitySkip = capacity.slice(
      capacity.indexOf("async function handleSkip"),
      capacity.indexOf("return (")
    );

    expect(needs).toContain("nav(pathAfterNeeds(isReceiverOnly()))");
    expect(needsSkip).not.toContain("/app/explore");
    expect(capacity).toContain("nav(pathAfterCapacity())");
    expect(capacitySkip).not.toContain("/app/explore");
    expect(recommendations).toContain("Skicka intresse");
    expect(recommendations).toContain('props.profileFrom !== "onboarding"');
  });
});
