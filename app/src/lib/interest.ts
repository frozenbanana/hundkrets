export const INTEREST_VERIFICATION_MESSAGE =
  "Verifiera din e-post innan du skickar intresse. Skicka ett nytt verifieringsmail och följ länken där.";

export function requiresInterestVerification(isVerified: boolean): boolean {
  return !isVerified;
}
