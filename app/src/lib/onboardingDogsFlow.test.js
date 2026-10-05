import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "routes/onboarding/dogs.tsx"),
  "utf8"
);

describe("onboarding dog actions", () => {
  it("saves and continues from the form submit path", () => {
    const continueHandler = source.slice(
      source.indexOf("async function handleSaveAndContinue"),
      source.indexOf("async function handleAddAnotherDog")
    );

    expect(source).toContain("<form onSubmit={handleSaveAndContinue}>");
    expect(continueHandler).toContain("await createDog()");
    expect(continueHandler).toContain('nav("/onboarding/needs")');
    expect(source.match(/Spara och fortsätt/g)).toHaveLength(1);
  });

  it("saves and resets without navigating from the add-another path", () => {
    const addAnotherHandler = source.slice(
      source.indexOf("async function handleAddAnotherDog"),
      source.indexOf("const baseUrl")
    );

    expect(addAnotherHandler).toContain("await createDog()");
    expect(addAnotherHandler).toContain("resetDogForm()");
    expect(addAnotherHandler).toContain("refetch()");
    expect(addAnotherHandler).not.toContain('nav("/onboarding/needs")');
    expect(source).toContain("Lägg till ytterligare hund");
  });
});
