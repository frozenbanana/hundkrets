import { describe, expect, it } from "vitest";
import {
  INTEREST_VERIFICATION_MESSAGE,
  requiresInterestVerification,
} from "./interest";

describe("interest verification", () => {
  it("routes unverified members to verification instead of sending", () => {
    expect(requiresInterestVerification(false)).toBe(true);
    expect(INTEREST_VERIFICATION_MESSAGE).toContain("Skicka ett nytt verifieringsmail");
  });

  it("keeps verified members on the one-step send path", () => {
    expect(requiresInterestVerification(true)).toBe(false);
  });
});
