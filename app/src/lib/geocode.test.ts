import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  approximateCoords,
  geocodeMeetingArea,
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

describe("geocodeMeetingArea", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prioritizes exact natural place over city-biased street", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((async (input: URL | RequestInfo) => {
      const url = String(input);
      const q = new URL(url).searchParams.get("q");

      if (q?.includes("Vombsjön, Malmö, Sverige")) {
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [12.9726246, 55.5815959] },
                properties: {
                  street: "Vombsjögatan",
                  district: "Bellevuegården",
                  city: "Malmö",
                  countrycode: "SE",
                  osm_key: "highway",
                  osm_value: "residential",
                },
              },
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [13.376, 55.582] },
                properties: {
                  name: "Malmö",
                  countrycode: "SE",
                  // Empty city should not pass city filter.
                  city: "",
                  osm_key: "place",
                  osm_value: "city",
                },
              },
            ],
          }),
        } as Response;
      }

      if (q?.includes("Vombsjön Sverige")) {
        return {
          ok: true,
          json: async () => ({
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [13.59234, 55.684416] },
                properties: {
                  name: "Vombsjön",
                  state: "Lund Municipality",
                  countrycode: "SE",
                  osm_key: "natural",
                  osm_value: "water",
                },
              },
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [12.9726246, 55.5815959] },
                properties: {
                  street: "Vombsjögatan",
                  district: "Bellevuegården",
                  city: "Malmö",
                  countrycode: "SE",
                  osm_key: "highway",
                  osm_value: "residential",
                },
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ features: [] }),
      } as Response;
    }) as typeof fetch);

    const result = await geocodeMeetingArea("Vombsjön", { cityHint: "Malmö" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).not.toBeNull();
    expect(result?.lat).toBeCloseTo(55.684416, 5);
    expect(result?.lon).toBeCloseTo(13.59234, 5);
    expect(result?.lat).not.toBeCloseTo(55.5815959, 3);
    expect(result?.lon).not.toBeCloseTo(12.9726246, 3);
  });
});
