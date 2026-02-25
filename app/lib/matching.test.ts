import { describe, it, expect } from "vitest";
import {
  findMatches,
  type User,
  type Dog,
  type WatchNeed,
  type WatchCapacity,
} from "./matching";

describe("findMatches", () => {
  const me: User = { id: "me", area: "Malmö" };
  const other: User = { id: "other", area: "Malmö" };

  const myDog: Dog = { id: "my-dog", owner: "me", name: "Buddy", size: "medium", gender: "male" };
  const theirDog: Dog = { id: "their-dog", owner: "other", name: "Rex", size: "small", gender: "female" };

  it("returns empty when current user has no area", () => {
    const users: User[] = [{ ...me, area: "" }];
    const result = findMatches([], [], "me", users, []);
    expect(result).toEqual([]);
  });

  it("returns matches when dates overlap and dogs fit capacity", () => {
    const myNeed: WatchNeed = {
      id: "n1",
      user: "me",
      dog: "my-dog",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
    };
    const myCapacity: WatchCapacity = {
      id: "c1",
      user: "me",
      start_date: "2025-03-05",
      end_date: "2025-03-15",
      dog_sizes: "small",
      dog_genders: "any",
      max_dogs: 2,
    };
    const theirNeed: WatchNeed = {
      id: "n2",
      user: "other",
      dog: "their-dog",
      start_date: "2025-03-08",
      end_date: "2025-03-12",
    };
    const theirCapacity: WatchCapacity = {
      id: "c2",
      user: "other",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
      dog_sizes: "medium",
      dog_genders: "any",
      max_dogs: 1,
    };

    const result = findMatches(
      [myNeed, theirNeed],
      [myCapacity, theirCapacity],
      "me",
      [me, other],
      [myDog, theirDog]
    );

    expect(result).toHaveLength(1);
    expect(result[0].user.id).toBe("other");
    expect(result[0].theirNeed.id).toBe("n2");
    expect(result[0].myNeed.id).toBe("n1");
  });

  it("excludes matches when dates do not overlap", () => {
    // myCapacity Mar 1-5, theirNeed Mar 8-12 -> no overlap (I can't sit for them)
    // myNeed Mar 8-12, theirCapacity Mar 8-12 -> overlap (they can sit for me)
    // But findMatches requires BOTH: theirNeed overlaps myCapacity AND myNeed overlaps theirCapacity
    const myNeed: WatchNeed = {
      id: "n1",
      user: "me",
      dog: "my-dog",
      start_date: "2025-03-08",
      end_date: "2025-03-12",
    };
    const myCapacity: WatchCapacity = {
      id: "c1",
      user: "me",
      start_date: "2025-03-01",
      end_date: "2025-03-05",
      dog_sizes: "small",
      dog_genders: "any",
      max_dogs: 2,
    };
    const theirNeed: WatchNeed = {
      id: "n2",
      user: "other",
      dog: "their-dog",
      start_date: "2025-03-08",
      end_date: "2025-03-12",
    };
    const theirCapacity: WatchCapacity = {
      id: "c2",
      user: "other",
      start_date: "2025-03-01",
      end_date: "2025-03-05",
      dog_sizes: "medium",
      dog_genders: "any",
      max_dogs: 1,
    };

    const result = findMatches(
      [myNeed, theirNeed],
      [myCapacity, theirCapacity],
      "me",
      [me, other],
      [myDog, theirDog]
    );

    expect(result).toHaveLength(0);
  });

  it("excludes matches when dog size does not fit capacity", () => {
    const myNeed: WatchNeed = {
      id: "n1",
      user: "me",
      dog: "my-dog",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
    };
    const myCapacity: WatchCapacity = {
      id: "c1",
      user: "me",
      start_date: "2025-03-05",
      end_date: "2025-03-15",
      dog_sizes: "large",
      dog_genders: "any",
      max_dogs: 2,
    };
    const theirNeed: WatchNeed = {
      id: "n2",
      user: "other",
      dog: "their-dog",
      start_date: "2025-03-08",
      end_date: "2025-03-12",
    };
    const theirCapacity: WatchCapacity = {
      id: "c2",
      user: "other",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
      dog_sizes: "medium",
      dog_genders: "any",
      max_dogs: 1,
    };

    const result = findMatches(
      [myNeed, theirNeed],
      [myCapacity, theirCapacity],
      "me",
      [me, other],
      [myDog, theirDog]
    );

    expect(result).toHaveLength(0);
  });

  it("excludes users in different areas", () => {
    const stockholmUser: User = { id: "stockholm", area: "Stockholm" };
    const myNeed: WatchNeed = {
      id: "n1",
      user: "me",
      dog: "my-dog",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
    };
    const myCapacity: WatchCapacity = {
      id: "c1",
      user: "me",
      start_date: "2025-03-05",
      end_date: "2025-03-15",
      dog_sizes: "small",
      dog_genders: "any",
      max_dogs: 2,
    };
    const theirNeed: WatchNeed = {
      id: "n2",
      user: "stockholm",
      dog: "their-dog",
      start_date: "2025-03-08",
      end_date: "2025-03-12",
    };
    const theirCapacity: WatchCapacity = {
      id: "c2",
      user: "stockholm",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
      dog_sizes: "medium",
      dog_genders: "any",
      max_dogs: 1,
    };

    const result = findMatches(
      [myNeed, theirNeed],
      [myCapacity, theirCapacity],
      "me",
      [me, stockholmUser],
      [myDog, theirDog]
    );

    expect(result).toHaveLength(0);
  });

  it("accepts capacity with dog_sizes=any and dog_genders=any", () => {
    const myNeed: WatchNeed = {
      id: "n1",
      user: "me",
      dog: "my-dog",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
    };
    const myCapacity: WatchCapacity = {
      id: "c1",
      user: "me",
      start_date: "2025-03-05",
      end_date: "2025-03-15",
      dog_sizes: "any",
      dog_genders: "any",
      max_dogs: 2,
    };
    const theirNeed: WatchNeed = {
      id: "n2",
      user: "other",
      dog: "their-dog",
      start_date: "2025-03-08",
      end_date: "2025-03-12",
    };
    const theirCapacity: WatchCapacity = {
      id: "c2",
      user: "other",
      start_date: "2025-03-01",
      end_date: "2025-03-10",
      dog_sizes: "any",
      dog_genders: "any",
      max_dogs: 1,
    };

    const result = findMatches(
      [myNeed, theirNeed],
      [myCapacity, theirCapacity],
      "me",
      [me, other],
      [myDog, theirDog]
    );

    expect(result).toHaveLength(1);
  });
});
