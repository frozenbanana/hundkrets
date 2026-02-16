import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { searchAddress, type GeocodeResult } from "~/lib/geocode";

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
  placeholder?: string;
  required?: boolean;
}

const DEBOUNCE_MS = 350;

export function AddressAutocomplete(props: Props) {
  const [query, setQuery] = createSignal("");
  const [suggestions, setSuggestions] = createSignal<GeocodeResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  let debounceId: ReturnType<typeof setTimeout> | null = null;

  const displayValue = () => {
    const v = props.value;
    if (v?.address_private) return v.address_private;
    if (v?.city || v?.neighborhood) {
      return [v.city, v.neighborhood].filter(Boolean).join(" - ");
    }
    return "";
  };

  onMount(() => {
    setQuery(displayValue());
  });

  function doSearch(q: string) {
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    searchAddress(q)
      .then((results) => {
        setSuggestions(results);
        setOpen(true);
      })
      .finally(() => setLoading(false));
  }

  function onInput(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    setQuery(v);
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(() => doSearch(v), DEBOUNCE_MS);
  }

  function onSelect(r: GeocodeResult) {
    const area = [r.city, r.neighborhood].filter(Boolean).join(" - ") || r.display_name;
    props.onSelect({
      address_private: r.display_name,
      latitude: r.lat,
      longitude: r.lon,
      city: r.city ?? "",
      neighborhood: r.neighborhood ?? "",
      area,
    });
    setQuery(r.display_name);
    setSuggestions([]);
    setOpen(false);
  }

  function onBlur() {
    setFocused(false);
    setTimeout(() => setOpen(false), 150);
  }

  onCleanup(() => {
    if (debounceId) clearTimeout(debounceId);
  });

  return (
    <div class="form-group" style="position: relative;">
      <label for="address">Address *</label>
      <input
        id="address"
        type="text"
        value={query()}
        onInput={onInput}
        onFocus={() => setFocused(true)}
        onBlur={onBlur}
        placeholder={props.placeholder ?? "Start typing your address..."}
        required={props.required ?? true}
        autocomplete="off"
      />
      <Show when={loading()}>
        <span style="position: absolute; right: 0.75rem; top: 2.25rem; font-size: 0.875rem; color: var(--color-text-muted);">
          Searching...
        </span>
      </Show>
      <Show when={open() && suggestions().length > 0}>
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            "border-radius": "var(--radius)",
            "box-shadow": "0 4px 12px rgba(0,0,0,0.15)",
            "max-height": "200px",
            overflow: "auto",
            "z-index": 100,
          }}
        >
          <For each={suggestions()}>
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
    </div>
  );
}
