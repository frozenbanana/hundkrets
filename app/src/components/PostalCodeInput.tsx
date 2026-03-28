import { createEffect, createSignal, untrack } from "solid-js";
import { geocodeCity, geocodePostalCode } from "~/lib/geocode";
import { lookupPostalCode } from "~/lib/postalCode";

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
  /** When true, the Område field is not rendered (caller renders it separately). */
  hideArea?: boolean;
}

/** Swedish postal code format: 123 45 or 12345 */
const SWEDISH_POSTAL = /^\d{3}\s?\d{2}$/;

/** Extract postal code from "Postnummer 211 42, Malmö" or similar */
function parsePostalFromAddress(addr: string | undefined): string {
  if (!addr) return "";
  const match = addr.match(/Postnummer\s+(\d{3}\s?\d{2})/i) ?? addr.match(/(\d{3}\s?\d{2})/);
  return match ? match[1].trim() : "";
}

function buildAddressPrivate(postalFormatted: string, city: string, area?: string): string {
  const parts = [city];
  if (area?.trim()) parts.push(area.trim());
  return `Postnummer ${postalFormatted}, ${parts.join(", ")}`.trim();
}

export function PostalCodeInput(props: Props) {
  const [postalCode, setPostalCode] = createSignal("");
  const [city, setCity] = createSignal("");
  const [area, setArea] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [manualCityHint, setManualCityHint] = createSignal("");

  createEffect(() => {
    const v = props.value;
    const parsed = parsePostalFromAddress(v?.address_private);
    const current = untrack(() => postalCode());
    if (parsed && parsed !== current) {
      setPostalCode(parsed);
      setCity(v?.city ?? "");
      setArea(v?.area ?? "");
    }
  });

  function formatPostalCode(val: string): string {
    const digits = val.replace(/\D/g, "").slice(0, 5);
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }

  function notifyChange() {
    const raw = postalCode().replace(/\s/g, "").trim();
    const formatted = formatPostalCode(raw);
    const cityVal = city().trim();
    const areaVal = area().trim();
    const addr = buildAddressPrivate(formatted, cityVal || "—", areaVal || undefined);
    props.onSelect({
      ...props.value,
      address_private: addr,
      city: cityVal,
      area: areaVal || undefined,
    });
  }

  async function resolveCityFallback() {
    const cityVal = city().trim();
    const raw = postalCode().replace(/\s/g, "").trim();
    if (!cityVal || !SWEDISH_POSTAL.test(raw)) {
      notifyChange();
      return;
    }

    // Only do city geocoding when we are in "postal not in register" mode.
    if (!manualCityHint()) {
      notifyChange();
      return;
    }

    setLoading(true);
    try {
      const geocodedCity = await geocodeCity(cityVal);
      if (!geocodedCity) {
        setError("Kunde inte hitta staden. Kontrollera stavning.");
        notifyChange();
        return;
      }
      setError("");
      const areaVal = area().trim();
      const formatted = formatPostalCode(raw);
      props.onSelect({
        ...props.value,
        address_private: buildAddressPrivate(formatted, cityVal, areaVal || undefined),
        latitude: geocodedCity.lat,
        longitude: geocodedCity.lon,
        city: cityVal,
        neighborhood: geocodedCity.neighborhood ?? "",
        area: areaVal || undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  async function resolvePostalCode() {
    const raw = postalCode().replace(/\s/g, "").trim();
    if (!SWEDISH_POSTAL.test(raw)) {
      if (raw.length >= 5) setError("Ange ett giltigt svenskt postnummer (123 45)");
      return;
    }
    setError("");
    setManualCityHint("");
    setLoading(true);
    try {
      const lookup = await lookupPostalCode(postalCode());
      if (!lookup) {
        // Missing in postal_codes: avoid potentially wrong Photon postcode suggestions.
        // User can fill city manually; submit flow will geocode coordinates from city.
        setCity((prev) => prev);
        setArea((prev) => prev);
        setManualCityHint("Postnumret saknas i vårt register. Fyll i stad manuellt så hämtar vi koordinater från staden.");
        const formatted = formatPostalCode(raw);
        const cityVal = city().trim();
        const areaVal = area().trim();
        props.onSelect({
          ...props.value,
          address_private: buildAddressPrivate(formatted, cityVal || "—", areaVal || undefined),
          city: cityVal,
          area: areaVal || undefined,
          latitude: undefined,
          longitude: undefined,
          neighborhood: "",
        });
        setLoading(false);
        return;
      }

      const geocoded = await geocodePostalCode(postalCode(), {
        city: lookup.city,
      });

      if (!geocoded) {
        setError("Kunde inte hitta området för detta postnummer.");
        setLoading(false);
        return;
      }

      const cityVal = lookup?.city ?? geocoded.city ?? "";
      const areaVal = lookup?.area ?? "";
      setCity(cityVal);
      setArea(areaVal);

      const formatted = formatPostalCode(raw);
      const areaDisplay = areaVal || undefined;
      props.onSelect({
        ...props.value,
        address_private: buildAddressPrivate(formatted, cityVal || "—", areaDisplay),
        latitude: geocoded.lat,
        longitude: geocoded.lon,
        city: cityVal,
        neighborhood: geocoded.neighborhood ?? "",
        area: areaDisplay,
      });
    } catch {
      setError("Kunde inte söka postnummer. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="form-group">
      <label for={props.id ?? "postal-code"}>Postnummer *</label>
      <input
        id={props.id ?? "postal-code"}
        type="text"
        inputMode="numeric"
        value={postalCode()}
        onInput={(e) => {
          const v = e.currentTarget.value;
          const formatted = formatPostalCode(v);
          setPostalCode(formatted);
          setManualCityHint("");
          if (!formatted) {
            setCity("");
            setArea("");
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
        aria-describedby={error() ? "postal-code-error" : undefined}
        classList={{
          "input-valid": !!city() && !loading(),
          "input-invalid": !!error(),
        }}
      />
      <div class="form-group" style="margin-top: 0.75rem;">
        <label for="postal-city">Stad *</label>
        <input
          id="postal-city"
          type="text"
          value={city()}
          onInput={(e) => {
            setCity(e.currentTarget.value);
            notifyChange();
          }}
          onBlur={() => {
            void resolveCityFallback();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void resolveCityFallback();
            }
          }}
          placeholder="T.ex. Malmö"
          autocomplete="address-level2"
          required
        />
      </div>
      {!props.hideArea && (
        <div class="form-group" style="margin-top: 0.75rem;">
          <label for="postal-area">Område (valfritt)</label>
          <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: -0.5rem 0 0.5rem 0;">
            Främst stadsdel. Kan också användas för att beskriva mer exakt vart du bor inom staden eller kommunen.
          </p>
          <input
            id="postal-area"
            type="text"
            value={area()}
            onInput={(e) => {
              setArea(e.currentTarget.value);
              notifyChange();
            }}
            onBlur={() => notifyChange()}
            placeholder="T.ex. Västra Hamnen"
            autocomplete="address-level3"
          />
        </div>
      )}
      {error() && (
        <p id="postal-code-error" class="form-error" role="alert" style="margin-top: 0.25rem;">
          {error()}
        </p>
      )}
      {loading() && (
        <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0.25rem 0 0;">Söker...</p>
      )}
      {manualCityHint() && !loading() && !error() && (
        <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0.25rem 0 0;">
          {manualCityHint()}
        </p>
      )}
    </div>
  );
}
