import { describe, it, expect } from "vitest";
import {
  approximateCoords,
  pointInBounds,
  type MapBounds,
} from "~/lib/geocode";

describe("approximateCoords", () => {
  it("returns deterministic result for same userId", () => {
    const [lat1, lon1] = approximateCoords(55.6, 13.0, "user-123");
    const [lat2, lon2] = approximateCoords(55.6, 13.0, "user-123");
    expect(lat1).toBe(lat2);
    expect(lon1).toBe(lon2);
  });

  it("returns different results for different userIds", () => {
    const [lat1, lon1] = approximateCoords(55.6, 13.0, "user-a");
    const [lat2, lon2] = approximateCoords(55.6, 13.0, "user-b");
    expect(lat1).not.toBe(lat2);
    expect(lon1).not.toBe(lon2);
  });

  it("returns coords within ~500m of original", () => {
    const [lat, lon] = approximateCoords(55.6, 13.0, "user-xyz");
    expect(Math.abs(lat - 55.6)).toBeLessThan(0.01);
    expect(Math.abs(lon - 13.0)).toBeLessThan(0.01);
  });
});

describe("pointInBounds", () => {
  const bounds: MapBounds = { north: 60, south: 55, east: 20, west: 10 };

  it("returns true for point inside bounds", () => {
    expect(pointInBounds(57, 15, bounds)).toBe(true);
  });

  it("returns true for point on boundary", () => {
    expect(pointInBounds(55, 10, bounds)).toBe(true);
    expect(pointInBounds(60, 20, bounds)).toBe(true);
  });

  it("returns false for point north of bounds", () => {
    expect(pointInBounds(61, 15, bounds)).toBe(false);
  });

  it("returns false for point south of bounds", () => {
    expect(pointInBounds(54, 15, bounds)).toBe(false);
  });

  it("returns false for point east of bounds", () => {
    expect(pointInBounds(57, 21, bounds)).toBe(false);
  });

  it("returns false for point west of bounds", () => {
    expect(pointInBounds(57, 9, bounds)).toBe(false);
  });
});
