import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("dog edit photo update", () => {
  it("clears legacy PocketBase image when saving a new image_key", () => {
    const source = readFileSync(
      resolve(process.cwd(), "routes/app/dogs/edit/[id].tsx"),
      "utf8"
    );
    expect(source).toContain("payload.image_key = uploaded.objectKey");
    expect(source).toContain("payload.image = null");
  });
});
