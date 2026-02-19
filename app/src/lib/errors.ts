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
          if (msg) return String(msg);
        }
      }
      if (res.message) return String(res.message);
    }
    return err.message || "Något gick fel. Försök igen.";
  }
  return "Något gick fel. Försök igen.";
}
