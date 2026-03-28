import { describe, expect, it } from "vitest";
import {
  coordsFromMapsUrl,
  excursionPreviewMapLayout,
  excursionPreviewMapSrc,
} from "./excursionListCard";

describe("coordsFromMapsUrl", () => {
  it("parses q=lat,lon", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps?q=55.5,13.08")).toEqual({ lat: 55.5, lon: 13.08 });
  });

  it("parses encoded q", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps?q=55.5%2C13.08")).toEqual({ lat: 55.5, lon: 13.08 });
  });

  it("parses @lat,lon in path", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps/@55.6,13.1,12z")).toEqual({ lat: 55.6, lon: 13.1 });
  });

  it("returns undefined for place name q", () => {
    expect(coordsFromMapsUrl("https://www.google.com/maps?q=Malmö")).toBeUndefined();
  });
});

describe("excursionPreviewMapSrc", () => {
  it("builds tile URL from coordinates", () => {
    const src = excursionPreviewMapSrc(59.3293, 18.0686);
    expect(src).toMatch(/^https:\/\/tile\.openstreetmap\.org\/14\/\d+\/\d+\.png$/);
  });

  it("uses meeting_map_url when coords missing", () => {
    const src = excursionPreviewMapSrc(undefined, undefined, "https://www.google.com/maps?q=55,13");
    expect(src).toMatch(/^https:\/\/tile\.openstreetmap\.org\//);
  });

  it("returns undefined when nothing to show", () => {
    expect(excursionPreviewMapSrc(undefined, undefined, undefined)).toBeUndefined();
    expect(excursionPreviewMapSrc(0, 0)).toBeUndefined();
  });
});

describe("excursionPreviewMapLayout", () => {
  it("centers point within tile offsets", () => {
    const L = excursionPreviewMapLayout(59.3293, 18.0686);
    expect(L).toBeDefined();
    expect(L!.tileUrl).toMatch(/^https:\/\/tile\.openstreetmap\.org\/14\/\d+\/\d+\.png$/);
    expect(L!.offsetX).toBeGreaterThanOrEqual(0);
    expect(L!.offsetX).toBeLessThan(256);
    expect(L!.offsetY).toBeGreaterThanOrEqual(0);
    expect(L!.offsetY).toBeLessThan(256);
  });
});
