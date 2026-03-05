/** Swedish postal code format: 123 45 or 12345 */
const SWEDISH_POSTAL = /^\d{3}\s?\d{2}$/;

export function buildFullAddress(street: string, postalCode: string, city: string): string {
  const parts = [street, postalCode, city].filter(Boolean);
  return parts.join(", ");
}

export function parseAddress(
  addressPrivate: string,
  cityFromDb?: string
): { street: string; postalCode: string; city: string } {
  // Handle "Postnummer 211 42, Malmö" format from onboarding (postal-code-only)
  const postnummerMatch = addressPrivate.match(/Postnummer\s+(\d{3}\s?\d{2}),\s*(.+)/i);
  if (postnummerMatch) {
    return {
      street: "",
      postalCode: postnummerMatch[1].trim(),
      city: postnummerMatch[2].trim(),
    };
  }

  const rawParts = addressPrivate.split(", ");
  const parts =
    rawParts.length > 1
      ? rawParts
          .map((p, i) => {
            if (i === 1 && /^[\d\s]+$/.test(p)) return p;
            if (i === rawParts.length - 1) return p;
            return p.trim();
          })
          .filter((p) => p.length > 0)
      : rawParts.filter((p) => p.length > 0);
  let street = "";
  let postalCode = "";
  let city = cityFromDb ?? "";

  if (parts.length >= 3) {
    street = parts[0];
    postalCode = parts[1].match(SWEDISH_POSTAL) ? parts[1] : "";
    city = parts[2];
  } else if (parts.length === 2) {
    if (parts[1].match(SWEDISH_POSTAL)) {
      street = parts[0];
      postalCode = parts[1];
      city = cityFromDb ?? "";
    } else if (/^[\d\s]+$/.test(parts[1])) {
      street = parts[0];
      postalCode = parts[1];
      city = cityFromDb ?? "";
    } else {
      street = parts[0];
      city = parts[1];
    }
  } else if (parts.length === 1) {
    street = parts[0];
    city = cityFromDb ?? "";
  }
  return { street, postalCode, city };
}
