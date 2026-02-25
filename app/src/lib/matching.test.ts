import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  findListings,
  type User,
  type Dog,
  type WatchNeed,
  type WatchCapacity,
} from "~/lib/matching";

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    expect(haversineDistance(55.6, 13.0, 55.6, 13.0)).toBe(0);
  });

  it("returns positive distance for different points", () => {
    const d = haversineDistance(55.6, 13.0, 59.33, 18.07); // Malmö to Stockholm
    expect(d).toBeGreaterThan(450);
    expect(d).toBeLessThan(550);
  });

  it("is symmetric", () => {
    const d1 = haversineDistance(55.6, 13.0, 59.33, 18.07);
    const d2 = haversineDistance(59.33, 18.07, 55.6, 13.0);
    expect(d1).toBe(d2);
  });

  it("handles antipodal points (~20,000 km)", () => {
    const d = haversineDistance(0, 0, 0, 180);
    expect(d).toBeCloseTo(20015, -2);
  });
});

describe("findListings", () => {
  const me: User = {
    id: "me",
    area: "Malmö",
    latitude: 55.605,
    longitude: 13.003,
  };

  const otherUser: User = {
    id: "other",
    area: "Malmö",
    latitude: 55.61,
    longitude: 13.01,
  };

  const farUser: User = {
    id: "far",
    area: "Stockholm",
    latitude: 59.33,
    longitude: 18.07,
  };

  const dog: Dog = { id: "d1", owner: "other", name: "Rex", size: "medium", gender: "male" };
  const need: WatchNeed = {
    id: "n1",
    user: "other",
    dog: "d1",
    start_date: "2025-03-01",
    end_date: "2025-03-10",
  };
  const capacity: WatchCapacity = {
    id: "c1",
    user: "other",
    start_date: "2025-03-05",
    end_date: "2025-03-15",
    dog_sizes: "medium",
    dog_genders: "male",
    max_dogs: 2,
  };

  it("returns empty when current user has no coords and no area", () => {
    const users: User[] = [{ ...me, latitude: undefined, longitude: undefined, area: "" }];
    const result = findListings([], [], "me", users, [], 50);
    expect(result).toEqual([]);
  });

  it("filters by distance when user has coordinates", () => {
    const users = [me, otherUser, farUser];
    const result = findListings(
      [need],
      [capacity],
      "me",
      users,
      [dog],
      50
    );
    expect(result).toHaveLength(1);
    expect(result[0].user.id).toBe("other");
    expect(result[0].distanceKm).toBeDefined();
    expect(result[0].distanceKm!).toBeLessThan(5);
  });

  it("excludes users beyond maxDistanceKm", () => {
    const users = [me, otherUser, farUser];
    const farNeed: WatchNeed = { ...need, id: "n-far", user: "far" };
    const farCapacity: WatchCapacity = { ...capacity, id: "c-far", user: "far" };
    const result = findListings(
      [need, farNeed],
      [capacity, farCapacity],
      "me",
      users,
      [dog, { ...dog, id: "d-far", owner: "far" }],
      1
    );
    expect(result).toHaveLength(1);
    expect(result[0].user.id).toBe("other");
  });

  it("falls back to area match when user has no coordinates", () => {
    const meNoCoords: User = { ...me, latitude: undefined, longitude: undefined, area: "Malmö" };
    const users = [meNoCoords, otherUser];
    const result = findListings(
      [need],
      [capacity],
      "me",
      users,
      [dog],
      50
    );
    expect(result).toHaveLength(1);
    expect(result[0].user.id).toBe("other");
    expect(result[0].distanceKm).toBeUndefined();
  });

  it("normalizes area for matching (case, punctuation)", () => {
    const meNoCoords: User = { ...me, latitude: undefined, longitude: undefined, area: "  malmö  " };
    const otherInMalmö: User = { ...otherUser, area: "Malmö", latitude: undefined, longitude: undefined };
    const users = [meNoCoords, otherInMalmö];
    const result = findListings([need], [capacity], "me", users, [dog], 50);
    expect(result).toHaveLength(1);
  });

  it("excludes current user from results", () => {
    const users = [me];
    const myNeed: WatchNeed = { ...need, user: "me" };
    const myCapacity: WatchCapacity = { ...capacity, user: "me" };
    const result = findListings([myNeed], [myCapacity], "me", users, [dog], 50);
    expect(result).toHaveLength(0);
  });

  it("excludes users with no needs and no capacities", () => {
    const users = [me, otherUser];
    const result = findListings([], [], "me", users, [dog], 50);
    expect(result).toHaveLength(0);
  });

  it("sorts by distance ascending", () => {
    const midUser: User = {
      id: "mid",
      area: "Malmö",
      latitude: 55.607,
      longitude: 13.005,
    };
    const users = [me, otherUser, midUser];
    const midNeed: WatchNeed = { ...need, id: "n2", user: "mid" };
    const midCapacity: WatchCapacity = { ...capacity, id: "c2", user: "mid" };
    const result = findListings(
      [need, midNeed],
      [capacity, midCapacity],
      "me",
      users,
      [dog, { ...dog, id: "d2", owner: "mid" }],
      50
    );
    expect(result).toHaveLength(2);
    expect(result[0].distanceKm!).toBeLessThanOrEqual(result[1].distanceKm!);
  });
});
