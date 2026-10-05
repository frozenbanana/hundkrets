import { describe, expect, it } from "vitest";
import { personCardPresentation } from "../../routes/app/explore/helpers";

const dog = { id: "d1" };

describe("personCardPresentation", () => {
  it("keeps a photo layout when the person has a dog", () => {
    expect(
      personCardPresentation({ dogs: [dog], needs: [{ id: "n" }], capacities: [] })
    ).toEqual({ layout: "photo", headline: null });
  });

  it("uses a profile layout and a sitting offer for someone without a dog", () => {
    expect(
      personCardPresentation({ dogs: [], needs: [], capacities: [{ id: "c" }] })
    ).toEqual({ layout: "profile", headline: "Erbjuder passning" });
  });

  it("labels a need without a dog as looking for care", () => {
    expect(
      personCardPresentation({ dogs: [], needs: [{ id: "n" }], capacities: [] })
    ).toEqual({ layout: "profile", headline: "Söker passning" });
  });

  it("labels both directions when there is still no dog", () => {
    expect(
      personCardPresentation({
        dogs: [],
        needs: [{ id: "n" }],
        capacities: [{ id: "c" }],
      })
    ).toEqual({ layout: "profile", headline: "Söker och erbjuder passning" });
  });
});
