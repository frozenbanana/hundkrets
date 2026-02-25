import { describe, it, expect } from "vitest";
import { toApiPath } from "~/lib/dog-ceo";

describe("toApiPath", () => {
  it("maps known breeds from BREED_MAP", () => {
    expect(toApiPath("golden retriever")).toBe("retriever/golden");
    expect(toApiPath("labrador")).toBe("labrador");
    expect(toApiPath("Labrador")).toBe("labrador");
    expect(toApiPath("  LABRADOR  ")).toBe("labrador");
  });

  it("maps Swedish breed names", () => {
    expect(toApiPath("schäfer")).toBe("german/shepherd");
    expect(toApiPath("pudel")).toBe("poodle");
    expect(toApiPath("blandras")).toBe("mix");
  });

  it("returns null for empty or whitespace", () => {
    expect(toApiPath("")).toBe(null);
    expect(toApiPath("   ")).toBe(null);
  });

  it("slugifies unknown breeds", () => {
    expect(toApiPath("Some Breed")).toBe("some-breed");
    expect(toApiPath("Newfoundland")).toBe("newfoundland");
  });

  it("strips non-alphanumeric from unknown breeds", () => {
    expect(toApiPath("breed123")).toBe("breed123");
    expect(toApiPath("a-b-c")).toBe("a-b-c");
  });

  it("handles multi-word mapped breeds", () => {
    expect(toApiPath("cavalier king charles spaniel")).toBe("spaniel/cocker");
    expect(toApiPath("german shepherd")).toBe("german/shepherd");
    expect(toApiPath("australian shepherd")).toBe("australian/shepherd");
  });
});
