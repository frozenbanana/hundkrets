import { createEffect, createSignal, untrack } from "solid-js";
import { geocodePostalCode } from "~/lib/geocode";

export interface PostalCodeValue {
  address_private?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  neighborhood?: string;
  area?: string;
}

interface Props {
  value: Partial<PostalCodeValue>;
  onSelect: (v: Partial<PostalCodeValue>) => void;
  id?: string;
}

/** Swedish postal code format: 123 45 or 12345 */
const SWEDISH_POSTAL = /^\d{3}\s?\d{2}$/;

/** Extract postal code from "Postnummer 211 42, Malmö" or similar */
function parsePostalFromAddress(addr: string | undefined): string {
  if (!addr) return "";
  const match = addr.match(/Postnummer\s+(\d{3}\s?\d{2})/i) ?? addr.match(/(\d{3}\s?\d{2})/);
  return match ? match[1].trim() : "";
}

export function PostalCodeInput(props: Props) {
  const [postalCode, setPostalCode] = createSignal("");
  const [resolvedCity, setResolvedCity] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  createEffect(() => {
    const v = props.value;
    const parsed = parsePostalFromAddress(v?.address_private);
    const current = untrack(() => postalCode());
    if (parsed && parsed !== current) {
      setPostalCode(parsed);
      setResolvedCity(v?.area ?? v?.city ?? "");
    }
  });

  function formatPostalCode(val: string): string {
    const digits = val.replace(/\D/g, "").slice(0, 5);
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }

  async function resolvePostalCode() {
    const raw = postalCode().replace(/\s/g, "").trim();
    if (!SWEDISH_POSTAL.test(raw)) {
      if (raw.length >= 5) setError("Ange ett giltigt svenskt postnummer (123 45)");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await geocodePostalCode(postalCode());
      if (result) {
        const formatted = formatPostalCode(raw);
        const area = result.city || result.neighborhood || result.display_name || "";
        setResolvedCity(area);
        props.onSelect({
          ...props.value,
          address_private: `Postnummer ${formatted}, ${area}`.trim(),
          latitude: result.lat,
          longitude: result.lon,
          city: result.city ?? "",
          neighborhood: result.neighborhood ?? "",
          area,
        });
      } else {
        setError("Kunde inte hitta området för detta postnummer.");
      }
    } catch {
      setError("Kunde inte söka postnummer. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="form-group">
      <label for={props.id ?? "postal-code"}>Postnummer *</label>
      <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
        <input
          id={props.id ?? "postal-code"}
          type="text"
          inputMode="numeric"
          value={postalCode()}
          onInput={(e) => {
            const v = e.currentTarget.value;
            const formatted = formatPostalCode(v);
            setPostalCode(formatted);
            if (!formatted) {
              setResolvedCity("");
              setError("");
            }
          }}
          onBlur={() => resolvePostalCode()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              resolvePostalCode();
            }
          }}
          placeholder="T.ex. 211 42"
          autocomplete="postal-code"
          required
          aria-describedby={error() ? "postal-code-error" : resolvedCity() ? "postal-code-city" : undefined}
          classList={{
            "input-valid": !!resolvedCity() && !loading(),
            "input-invalid": !!error(),
          }}
        />
      </div>
      {resolvedCity() && (
        <p id="postal-code-city" style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0.25rem 0 0;">
          {resolvedCity()}
        </p>
      )}
      {error() && (
        <p id="postal-code-error" class="form-error" role="alert" style="margin-top: 0.25rem;">
          {error()}
        </p>
      )}
      {loading() && (
        <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0.25rem 0 0;">Söker...</p>
      )}
    </div>
  );
}
