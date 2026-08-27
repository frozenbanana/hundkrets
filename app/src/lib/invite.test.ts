import { describe, expect, it } from "vitest";
import { inviteRegisterUrl } from "./invite";

describe("inviteRegisterUrl", () => {
  it("points at register with invite UTM", () => {
    expect(inviteRegisterUrl("https://hundkrets.se")).toBe(
      "https://hundkrets.se/register?utm_source=invite&utm_medium=share&utm_campaign=neighbor"
    );
  });

  it("strips a trailing slash on the origin", () => {
    expect(inviteRegisterUrl("https://hundkrets.se/")).toBe(
      "https://hundkrets.se/register?utm_source=invite&utm_medium=share&utm_campaign=neighbor"
    );
  });
});
