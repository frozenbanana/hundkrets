import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { searchAddress, searchCitiesSweden, type GeocodeResult } from "~/lib/geocode";

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
  onSelect: (v: AddressValue) => void;
}

const DEBOUNCE_MS = 350;

export function SwedishAddressInput(props: Props) {
  const [cityQuery, setCityQuery] = createSignal("");
  const [streetQuery, setStreetQuery] = createSignal("");
  const [citySuggestions, setCitySuggestions] = createSignal<GeocodeResult[]>([]);
  const [streetSuggestions, setStreetSuggestions] = createSignal<GeocodeResult[]>([]);
  const [cityLoading, setCityLoading] = createSignal(false);
  const [streetLoading, setStreetLoading] = createSignal(false);
  const [cityOpen, setCityOpen] = createSignal(false);
  const [streetOpen, setStreetOpen] = createSignal(false);
  const [selectedCity, setSelectedCity] = createSignal<string>("");
  let cityDebounce: ReturnType<typeof setTimeout> | null = null;
  let streetDebounce: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    const v = props.value;
    if (v?.city) setSelectedCity(v.city);
    setCityQuery(v?.city ?? "");
    setStreetQuery(v?.address_private ?? "");
  });

  function doCitySearch(q: string) {
    if (!q || q.length < 3) {
      setCitySuggestions([]);
      return;
    }
    setCityLoading(true);
    searchCitiesSweden(q)
      .then((r) => {
        setCitySuggestions(r);
        setCityOpen(true);
      })
      .finally(() => setCityLoading(false));
  }

  function doStreetSearch(q: string) {
    const city = selectedCity();
    if (!q || q.length < 3) {
      setStreetSuggestions([]);
      return;
    }
    setStreetLoading(true);
    searchAddress(q, city ? { city } : undefined)
      .then((r) => {
        setStreetSuggestions(r);
        setStreetOpen(true);
      })
      .finally(() => setStreetLoading(false));
  }

  function onCityInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    setCityQuery(v);
    setSelectedCity("");
    if (cityDebounce) clearTimeout(cityDebounce);
    cityDebounce = setTimeout(() => doCitySearch(v), DEBOUNCE_MS);
  }

  function onStreetInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    setStreetQuery(v);
    if (streetDebounce) clearTimeout(streetDebounce);
    streetDebounce = setTimeout(() => doStreetSearch(v), DEBOUNCE_MS);
  }

  function onCitySelect(r: GeocodeResult) {
    const city = r.city ?? r.display_name;
    setSelectedCity(city);
    setCityQuery(city);
    setCitySuggestions([]);
    setCityOpen(false);
    setStreetQuery("");
    props.onSelect({
      address_private: city,
      latitude: r.lat,
      longitude: r.lon,
      city,
      neighborhood: r.neighborhood ?? "",
      area: city,
    });
  }

  function onStreetSelect(r: GeocodeResult) {
    const area = [r.city, r.neighborhood].filter(Boolean).join(" - ") || r.display_name;
    props.onSelect({
      address_private: r.display_name,
      latitude: r.lat,
      longitude: r.lon,
      city: r.city ?? selectedCity() ?? "",
      neighborhood: r.neighborhood ?? "",
      area,
    });
    setStreetQuery(r.display_name);
    setStreetSuggestions([]);
    setStreetOpen(false);
  }

  onCleanup(() => {
    if (cityDebounce) clearTimeout(cityDebounce);
    if (streetDebounce) clearTimeout(streetDebounce);
  });

  function AutocompleteList(
    suggestions: GeocodeResult[],
    open: boolean,
    onSelect: (r: GeocodeResult) => void,
    loading: boolean
  ) {
    return (
      <Show when={open && suggestions.length > 0}>
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "#ffffff",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxHeight: "200px",
            overflow: "auto",
            zIndex: 100,
          }}
        >
          <For each={suggestions}>
            {(s) => (
              <li>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(s);
                  }}
                >
                  {s.display_name}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    );
  }

  return (
    <>
      <div class="form-group" style="position: relative;">
        <label for="city">Stad *</label>
        <input
          id="city"
          type="text"
          value={cityQuery()}
          onInput={onCityInput}
          onFocus={() => setCityOpen(true)}
          onBlur={() => setTimeout(() => setCityOpen(false), 150)}
          placeholder="T.ex. Malmö, Stockholm..."
          required
          autocomplete="nope"
          data-lpignore="true"
        />
        <Show when={cityLoading()}>
          <span style="position: absolute; right: 0.75rem; top: 2.25rem; font-size: 0.875rem; color: var(--color-text-muted);">
            Söker...
          </span>
        </Show>
        {AutocompleteList(citySuggestions(), cityOpen(), onCitySelect, cityLoading())}
      </div>
      <div class="form-group" style="position: relative;">
        <label for="street">Gata och adress *</label>
        <input
          id="street"
          type="text"
          value={streetQuery()}
          onInput={onStreetInput}
          onFocus={() => setStreetOpen(true)}
          onBlur={() => setTimeout(() => setStreetOpen(false), 150)}
          placeholder={selectedCity() ? `T.ex. Storgatan 1 i ${selectedCity()}` : "Välj stad först"}
          required
          autocomplete="nope"
          data-lpignore="true"
          disabled={!selectedCity()}
        />
        <Show when={!selectedCity()}>
          <span style="font-size: 0.875rem; color: var(--color-text-muted);">Välj stad först för att söka adress</span>
        </Show>
        <Show when={streetLoading()}>
          <span style="position: absolute; right: 0.75rem; top: 2.25rem; font-size: 0.875rem; color: var(--color-text-muted);">
            Söker...
          </span>
        </Show>
        {AutocompleteList(streetSuggestions(), streetOpen(), onStreetSelect, streetLoading())}
      </div>
    </>
  );
}
