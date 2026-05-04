import { useNavigate } from "@solidjs/router";
import { showToast } from "~/lib/toast";
import { createSignal, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { setOnboardingUserType, getOnboardingUserType, isReceiverOnly, isSitterOnly } from "~/lib/onboarding";
import { geocodeCity, geocodePostalCode } from "~/lib/geocode";
import { lookupPostalCode } from "~/lib/postalCode";
import { parseApiError } from "~/lib/errors";
import { OnboardingShell } from "~/components/OnboardingShell";
import { PostalCodeInput, type PostalCodeValue } from "~/components/PostalCodeInput";
import { ValidatedInput } from "~/components/ValidatedInput";
import { LocationPicker } from "~/components/LocationPicker";

export default function OnboardingChoice() {
  const nav = useNavigate();
  const [userType, setUserType] = createSignal<"has_dogs" | "sitter_only" | "receiver_only" | null>(null);
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal<Partial<PostalCodeValue>>({});
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
    if (done) {
      nav("/app/explore", { replace: true });
      return;
    }
    const user = pb.authStore.model;
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setAddress({
        address_private: user.address_private,
        latitude: user.latitude,
        longitude: user.longitude,
        city: user.city,
        neighborhood: user.neighborhood,
        area: user.area,
      });
    }
    setUserType(getOnboardingUserType());
  });

  function handleChoice(type: "has_dogs" | "sitter_only" | "receiver_only") {
    setOnboardingUserType(type);
    setUserType(type);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");

      const form = e.target as HTMLFormElement;
      const postalInput = form.querySelector<HTMLInputElement>("#postal-code")?.value?.trim();
      const cityInput = form.querySelector<HTMLInputElement>("#postal-city")?.value?.trim();
      const areaInput = form.querySelector<HTMLInputElement>("#postal-area")?.value?.trim();

      let addr = address();
      if (!addr.latitude || !addr.longitude) {
        if (postalInput) {
          const lookup = await lookupPostalCode(postalInput);
          if (lookup?.city) {
            const geocoded = await geocodePostalCode(postalInput, {
              city: lookup.city,
            });
            if (geocoded) {
              const city = cityInput || lookup.city || geocoded.city || "";
              const area = areaInput || (lookup.area ?? geocoded.neighborhood ?? "");
              const raw = postalInput.replace(/\s/g, "").trim();
              const formatted = raw.length === 5 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : postalInput;
              const parts = [city, area].filter(Boolean);
              addr = {
                address_private: `Postnummer ${formatted}, ${parts.join(", ")}`.trim(),
                latitude: geocoded.lat,
                longitude: geocoded.lon,
                city,
                neighborhood: geocoded.neighborhood ?? "",
                area: area || undefined,
              };
            }
          }
        }
        if ((!addr.latitude || !addr.longitude) && cityInput) {
          const geocodedCity = await geocodeCity(cityInput);
          if (geocodedCity) {
            const raw = (postalInput ?? "").replace(/\s/g, "").trim();
            const formatted = raw.length === 5 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : (postalInput ?? "");
            const city = cityInput;
            const area = areaInput || addr.area || geocodedCity.neighborhood || "";
            const parts = [city, area].filter(Boolean);
            addr = {
              ...addr,
              address_private: `Postnummer ${formatted}, ${parts.join(", ")}`.trim(),
              latitude: geocodedCity.lat,
              longitude: geocodedCity.lon,
              city,
              neighborhood: geocodedCity.neighborhood ?? "",
              area: area || undefined,
            };
          }
        }
      } else {
        addr = { ...addr, city: cityInput ?? addr.city, area: areaInput || addr.area };
        const raw = (postalInput ?? "").replace(/\s/g, "").trim();
        const formatted = raw.length === 5 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : postalInput ?? "";
        addr = {
          ...addr,
          address_private: `Postnummer ${formatted}, ${[addr.city, addr.area].filter(Boolean).join(", ")}`.trim(),
        };
      }
      if (!addr.latitude || !addr.longitude) {
        setError("Kunde inte hitta koordinater. Kontrollera postnummer och stad.");
        setLoading(false);
        return;
      }
      if (!addr.city?.trim()) {
        setError("Fyll i stad.");
        setLoading(false);
        return;
      }
      if (!name().trim()) {
        setError("Fyll i ditt namn.");
        setLoading(false);
        return;
      }

      const areaVal = addr.area ?? addr.city ?? "";
      await pb.collection("users").update(userId, {
        name: name(),
        phone: phone() || undefined,
        area: areaVal,
        city: addr.city,
        neighborhood: addr.neighborhood,
        address_private: addr.address_private,
        latitude: addr.latitude,
        longitude: addr.longitude,
      });
      pb.authStore.save(pb.authStore.token!, {
        ...pb.authStore.model,
        name: name(),
        phone: phone(),
        area: areaVal,
        city: addr.city,
        neighborhood: addr.neighborhood,
        address_private: addr.address_private,
        latitude: addr.latitude,
        longitude: addr.longitude,
      });

      showToast("Sparat");
      const type = userType();
      if (!type) return;
      if (type === "sitter_only") {
        nav("/onboarding/capacity");
      } else {
        nav("/onboarding/dogs");
      }
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell
      step={1}
      totalSteps={userType() ? (isSitterOnly() ? 3 : isReceiverOnly() ? 4 : 5) : 5}
      title="Vad vill du göra?"
      nextStepHint="Nästa: Fyll i namn och postnummer"
      backHref="history"
    >
      <div class="card">
        {userType() ? (
            <form onSubmit={handleSubmit}>
              {error() && <p class="form-error" role="alert" style="margin-bottom: 1rem;">{error()}</p>}
              <section style="margin-bottom: 1.5rem;">
                <h2 style="font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--color-text);">Namn och område</h2>
              <div class="form-group">
                <label for="name">Namn *</label>
                <ValidatedInput
                  id="name"
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  validation="required"
                  required
                  placeholder="Ditt namn"
                  autocomplete="name"
                />
              </div>
              <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: -0.5rem 0 0.75rem;">
                Postnumret används för att hitta hundägare i ditt område. Din exakta adress delas inte.
              </p>
                <PostalCodeInput id="postal-code" value={address()} onSelect={setAddress} hideArea />
                <Show
                  when={address().latitude && address().longitude && !(address().latitude === 0 && address().longitude === 0)}
                  fallback={<p class="excursions-map-hidden-hint">Skriv din postkod för att visa kartan.</p>}
                >
                  <LocationPicker
                    lat={address().latitude!}
                    lon={address().longitude!}
                    onChange={(lat, lon) => setAddress((prev) => ({ ...prev, latitude: lat, longitude: lon }))}
                  />
                  <p class="location-picker-hint">
                    Dra markören eller klicka på kartan för att justera din ungefärliga position. Cirkeln visar ett område på ca 300 m.
                  </p>
                </Show>
                <div class="form-group" style="margin-top: 0.75rem;">
                  <label for="postal-area">Område (valfritt)</label>
                  <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: -0.5rem 0 0.5rem 0;">
                    Främst stadsdel. Kan också användas för att beskriva mer exakt vart du bor inom staden eller kommunen.
                  </p>
                  <input
                    id="postal-area"
                    type="text"
                    value={address().area ?? ""}
                    onInput={(e) => setAddress((prev) => ({ ...prev, area: e.currentTarget.value }))}
                    placeholder="T.ex. Västra Hamnen"
                    autocomplete="address-level3"
                  />
                </div>
                <div class="form-group" style="margin-top: 0.75rem;">
                  <label for="phone">Telefon (valfritt)</label>
                  <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0.4rem 0 0.5rem;">
                    Ditt nummer visas bara för personer du har matchat med. Om du inte vill ange telefon
                    kan ni alltid prata vidare i chatten.
                  </p>
                  <input
                    id="phone"
                    type="tel"
                    value={phone()}
                    onInput={(e) => setPhone(e.currentTarget.value)}
                    placeholder="070-123 45 67"
                    autocomplete="tel"
                  />
                </div>
              </section>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="submit" class="btn" disabled={loading()} data-umami-event="Onboarding profile submit">
                {loading() ? "Sparar..." : "Spara och fortsätt"}
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                onClick={() => setUserType(null)}
              >
                Ändra val
              </button>
            </div>
          </form>
        ) : (
          <>
            <p style="color: var(--color-text); margin-bottom: 0.5rem;">
              Välj hur du vill använda Hundkrets. Du kan alltid ändra senare.
            </p>
            <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
              Nästa steg: du fyller i namn och postnummer så att vi kan hitta hundägare i ditt område.
            </p>
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <button
                type="button"
                class="btn"
                onClick={() => handleChoice("has_dogs")}
                style="text-align: left; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;"
                data-umami-event="Onboarding choice"
                data-umami-event-type="has_dogs"
              >
                <strong>Byta hundpassning</strong>
              </button>
              <button
                type="button"
                class="btn btn-receiver"
                onClick={() => handleChoice("receiver_only")}
                style="text-align: left; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;"
                data-umami-event="Onboarding choice"
                data-umami-event-type="receiver_only"
              >
                <strong>Endast ta emot passning</strong>
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                onClick={() => handleChoice("sitter_only")}
                style="text-align: left; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;"
                data-umami-event="Onboarding choice"
                data-umami-event-type="sitter_only"
              >
                <strong>Endast passa hundar</strong>
              </button>
            </div>
          </>
        )}
      </div>
    </OnboardingShell>
  );
}
