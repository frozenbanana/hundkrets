import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("VideoCaptureInput gallery picker", () => {
  it("does not force the camera for Välj från galleri", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/VideoCaptureInput.tsx"),
      "utf8"
    );
    const galleryInput = source.slice(
      source.indexOf("Välj från galleri"),
      source.indexOf("Spela in")
    );
    expect(galleryInput).toContain('accept="video/*"');
    expect(galleryInput).not.toMatch(/capture=/);
  });
});
