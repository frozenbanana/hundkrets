import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("media list requests", () => {
  it("disables PocketBase auto-cancellation for overlapping profile fetches", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/media.ts"), "utf8");
    expect(source).toContain("requestKey: null");
  });
});
