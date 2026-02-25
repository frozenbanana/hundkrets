import { batch, createEffect, createSignal, untrack } from "solid-js";
import { buildFullAddress, parseAddress } from "~/lib/address";

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

export function SwedishAddressInput(props: Props) {
  const [street, setStreet] = createSignal("");
  const [postalCode, setPostalCode] = createSignal("");
  const [city, setCity] = createSignal("");

  createEffect(() => {
    const v = props.value;
    if (!v?.address_private) return;
    const parsed = parseAddress(v.address_private, v.city);
    const currentStreet = untrack(() => street());
    const currentPostal = untrack(() => postalCode());
    const currentCity = untrack(() => city());
    batch(() => {
      if (parsed.street !== currentStreet) setStreet(parsed.street);
      if (parsed.postalCode !== currentPostal) setPostalCode(parsed.postalCode);
      if (parsed.city !== currentCity) setCity(parsed.city);
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
