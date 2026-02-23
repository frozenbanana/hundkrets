import { batch, createEffect, createSignal } from "solid-js";

export interface AddressValue {
  address_private: string;
  latitude: number;
  longitude: number;
  city: string;
  neighborhood: string;
  area: string;
}

interface Props {
  value: Partial<AddressValue>;
  onSelect: (v: Partial<AddressValue>) => void;
}

const SWEDISH_POSTAL = /^\d{3}\s?\d{2}$/;

function buildFullAddress(street: string, postalCode: string, city: string): string {
  const parts = [street, postalCode, city].filter(Boolean);
  return parts.join(", ");
}

function parseAddress(addressPrivate: string, cityFromDb?: string): { street: string; postalCode: string; city: string } {
  const parts = addressPrivate.split(", ").map((p) => p.trim()).filter(Boolean);
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

export function SwedishAddressInput(props: Props) {
  const [street, setStreet] = createSignal("");
  const [postalCode, setPostalCode] = createSignal("");
  const [city, setCity] = createSignal("");

  createEffect(() => {
    const v = props.value;
    if (!v?.address_private) return;
    const parsed = parseAddress(v.address_private, v.city);
    batch(() => {
      if (parsed.street !== street()) setStreet(parsed.street);
      if (parsed.postalCode !== postalCode()) setPostalCode(parsed.postalCode);
      if (parsed.city !== city()) setCity(parsed.city);
    });
  });

  function notifyChange(streetVal: string, postalVal: string, cityVal: string) {
    const full = buildFullAddress(streetVal, postalVal, cityVal);
    props.onSelect({
      ...props.value,
      address_private: full,
      city: cityVal,
    });
  }

  return (
    <>
      <div class="form-group">
        <label for="address-line1">Gata och nummer *</label>
        <input
          id="address-line1"
          type="text"
          value={street()}
          onInput={(e) => {
            const v = e.currentTarget.value;
            setStreet(v);
            notifyChange(v, postalCode(), city());
          }}
          placeholder="T.ex. Storgatan 1"
          required
          autocomplete="off"
        />
      </div>
      <div class="form-group">
        <label for="postal-code">Postnummer</label>
        <input
          id="postal-code"
          type="text"
          value={postalCode()}
          onInput={(e) => {
            const v = e.currentTarget.value;
            setPostalCode(v);
            notifyChange(street(), v, city());
          }}
          placeholder="T.ex. 211 42"
          autocomplete="postal-code"
        />
      </div>
      <div class="form-group">
        <label for="address-level2">Stad *</label>
        <input
          id="address-level2"
          type="text"
          value={city()}
          onInput={(e) => {
            const v = e.currentTarget.value;
            setCity(v);
            notifyChange(street(), postalCode(), v);
          }}
          placeholder="T.ex. Malmö"
          required
          autocomplete="address-level2"
        />
      </div>
    </>
  );
}
