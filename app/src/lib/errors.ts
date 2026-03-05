/** Max filstorlek för bilder (5 MB), samma som PocketBase */
export const MAX_IMAGE_SIZE_BYTES = 5_242_880;

function translateToSwedish(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("maximum allowed file size") || lower.includes("5242880")) {
    return "Filen är för stor. Max 5 MB.";
  }
  if (lower.includes("failed to upload")) {
    return "Kunde inte ladda upp filen. Kontrollera att den är under 5 MB.";
  }
  if (lower.includes("record not found")) {
    return "Hittade inte posten.";
  }
  if (lower.includes("invalid") && lower.includes("token")) {
    return "Ogiltig eller utgången länk.";
  }
  return msg;
}

/**
 * Parse PocketBase API errors into user-friendly Swedish messages.
 * ClientResponseError has: status, response (or data), message
 * Validation errors: response.data = { fieldName: { message: "..." } }
 */
export function parseApiError(err: unknown): string {
  if (err instanceof Error) {
    const pbErr = err as {
      status?: number;
      response?: { message?: string; data?: Record<string, { message?: string } | string> };
      data?: Record<string, { message?: string } | string>;
    };
    const res = pbErr.response ?? pbErr.data;
    if (res) {
      const data = res.data ?? res;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const val = data[firstKey];
          const msg = typeof val === "string" ? val : (val as { message?: string })?.message;
          if (msg) return translateToSwedish(String(msg));
        }
      }
      if (res.message) return translateToSwedish(String(res.message));
    }
    return translateToSwedish(err.message || "Något gick fel. Försök igen.");
  }
  return "Något gick fel. Försök igen.";
}
