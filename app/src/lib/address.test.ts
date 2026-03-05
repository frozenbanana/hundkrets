import { describe, it, expect } from "vitest";
import { buildFullAddress, parseAddress } from "~/lib/address";

describe("buildFullAddress", () => {
  it("joins street, postal code, and city with comma", () => {
    expect(buildFullAddress("Storgatan 1", "211 42", "Malmö")).toBe(
      "Storgatan 1, 211 42, Malmö"
    );
  });

  it("filters empty parts", () => {
    expect(buildFullAddress("Storgatan 1", "", "Malmö")).toBe("Storgatan 1, Malmö");
    expect(buildFullAddress("", "211 42", "Malmö")).toBe("211 42, Malmö");
    expect(buildFullAddress("", "", "")).toBe("");
  });
});

describe("parseAddress", () => {
  it("parses full address: street, postal, city", () => {
    const r = parseAddress("Storgatan 1, 211 42, Malmö");
    expect(r).toEqual({ street: "Storgatan 1", postalCode: "211 42", city: "Malmö" });
  });

  it("recognizes Swedish postal format 123 45", () => {
    const r = parseAddress("Gatan 5, 123 45, Stockholm");
    expect(r.postalCode).toBe("123 45");
  });

  it("recognizes Swedish postal format 12345 (no space)", () => {
    const r = parseAddress("Gatan 5, 12345, Stockholm");
    expect(r.postalCode).toBe("12345");
  });

  it("parses street and city only (no postal)", () => {
    const r = parseAddress("Storgatan 1, Malmö");
    expect(r).toEqual({ street: "Storgatan 1", postalCode: "", city: "Malmö" });
  });

  it("parses single part as street", () => {
    const r = parseAddress("Storgatan 1");
    expect(r).toEqual({ street: "Storgatan 1", postalCode: "", city: "" });
  });

  it("uses cityFromDb when address has no city", () => {
    const r = parseAddress("Storgatan 1, 211 42", "Malmö");
    expect(r.city).toBe("Malmö");
  });

  it("handles numeric-only second part as postal", () => {
    const r = parseAddress("Storgatan 1, 21142");
    expect(r.postalCode).toBe("21142");
    expect(r.street).toBe("Storgatan 1");
  });

  it("parses Postnummer XXX XX, Ort format from onboarding", () => {
    const r = parseAddress("Postnummer 211 42, Malmö");
    expect(r).toEqual({ street: "", postalCode: "211 42", city: "Malmö" });
  });
});
