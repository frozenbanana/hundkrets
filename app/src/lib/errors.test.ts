import { describe, it, expect } from "vitest";
import { parseApiError } from "~/lib/errors";

describe("parseApiError", () => {
  it("returns validation field message when present", () => {
    const err = new Error("Request failed") as Error & {
      response?: { data?: Record<string, { message: string }> };
    };
    err.response = {
      data: { email: { message: "Ogiltig e-postadress" } },
    };
    expect(parseApiError(err)).toBe("Ogiltig e-postadress");
  });

  it("returns first validation message when multiple fields", () => {
    const err = new Error() as Error & {
      response?: { data?: Record<string, { message: string }> };
    };
    err.response = {
      data: {
        name: { message: "Namn krävs" },
        email: { message: "E-post krävs" },
      },
    };
    expect(parseApiError(err)).toBe("Namn krävs");
  });

  it("returns string value when field value is string", () => {
    const err = new Error() as Error & {
      response?: { data?: Record<string, string> };
    };
    err.response = { data: { field: "Detta är ett fel" } };
    expect(parseApiError(err)).toBe("Detta är ett fel");
  });

  it("returns response.message when no field data", () => {
    const err = new Error() as Error & {
      response?: { message: string };
    };
    err.response = { message: "Record not found" };
    expect(parseApiError(err)).toBe("Record not found");
  });

  it("returns Error.message when no response data", () => {
    const err = new Error("Network error");
    expect(parseApiError(err)).toBe("Network error");
  });

  it("returns fallback when Error has empty message", () => {
    const err = new Error("");
    expect(parseApiError(err)).toBe("Något gick fel. Försök igen.");
  });

  it("returns fallback for non-Error values", () => {
    expect(parseApiError("string")).toBe("Något gick fel. Försök igen.");
    expect(parseApiError(null)).toBe("Något gick fel. Försök igen.");
    expect(parseApiError(undefined)).toBe("Något gick fel. Försök igen.");
  });

  it("uses data when response has data alias", () => {
    const err = new Error() as Error & {
      data?: { message: string };
    };
    err.data = { message: "Server error" };
    expect(parseApiError(err)).toBe("Server error");
  });
});
