import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("profile API dog payload", () => {
  it("includes image_key so needs/profile prefer the latest R2 photo", () => {
    const source = readFileSync(
      resolve(process.cwd(), "routes/api/users/[id]/profile.ts"),
      "utf8"
    );
    const pickPublicDog = source.slice(
      source.indexOf("function pickPublicDog"),
      source.indexOf("function pickPublicNeed")
    );
    expect(pickPublicDog).toContain('"image_key"');
    expect(pickPublicDog).toContain('"image"');
  });
});
