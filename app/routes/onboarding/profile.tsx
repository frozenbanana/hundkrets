import { A, useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { geocodeAddress } from "~/lib/geocode";
import { OnboardingShell } from "~/components/OnboardingShell";
import { Avatar } from "~/components/Avatar";
import { SwedishAddressInput, type AddressValue } from "~/components/SwedishAddressInput";

export default function OnboardingProfile() {
  const nav = useNavigate();
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal<Partial<AddressValue>>({});
  const [breedsOwnedBefore, setBreedsOwnedBefore] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
      return;
    }
    const m = pb.authStore.model as { onboarding_complete?: boolean; area?: string } | null;
    const done = m?.onboarding_complete === true || (m?.onboarding_complete !== false && !!m?.area);
    if (done) {
      nav("/app/matches", { replace: true });
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
      setBreedsOwnedBefore(user.breeds_owned_before ?? "");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userId = pb.authStore.model?.id;
      if (!userId) throw new Error("Not authenticated");

      let addr = address();
      if (!addr.latitude || !addr.longitude) {
        const streetInput = (e.target as HTMLFormElement).querySelector<HTMLInputElement>("#street");
        const cityInput = (e.target as HTMLFormElement).querySelector<HTMLInputElement>("#city");
        const street = streetInput?.value?.trim();
        const city = cityInput?.value?.trim();
        const raw = street && city ? `${street}, ${city}, Sverige` : street || city;
        if (raw) {
          const geocoded = await geocodeAddress(raw, city || undefined);
          if (geocoded) {
            const area = [geocoded.city, geocoded.neighborhood].filter(Boolean).join(" - ") || geocoded.display_name;
            addr = {
              address_private: geocoded.display_name,
              latitude: geocoded.lat,
              longitude: geocoded.lon,
              city: geocoded.city ?? "",
              neighborhood: geocoded.neighborhood ?? "",
              area,
            };
          }
        }
      }
      if (!addr.latitude || !addr.longitude) {
        setError("Välj stad och adress från förslagen.");
        setLoading(false);
        return;
      }

      const areaVal = addr.area ?? ([addr.city, addr.neighborhood].filter(Boolean).join(" - ") || "");
      await pb.collection("users").update(userId, {
        name: name(),
        phone: phone(),
        area: areaVal,
        city: addr.city,
        neighborhood: addr.neighborhood,
        address_private: addr.address_private,
        latitude: addr.latitude,
        longitude: addr.longitude,
        breeds_owned_before: breedsOwnedBefore() || undefined,
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
        breeds_owned_before: breedsOwnedBefore(),
      });
      nav("/onboarding/dogs");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell step={1} totalSteps={4} title="Your profile">
      <div class="card">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <Avatar name={name()} city={address().city} neighborhood={address().neighborhood} />
        </div>
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
          Vi riktar oss till Sverige. Din adress hjälper att hitta matchningar i närheten. Din fullständiga adress visas bara när ni kopplar ihop.
        </p>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name">Namn</label>
            <input id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
          </div>
          <SwedishAddressInput value={address()} onSelect={setAddress} />
          <div class="form-group">
            <label for="breeds_owned_before">Vilka hundraser har du tidigare ägt?</label>
            <input id="breeds_owned_before" type="text" value={breedsOwnedBefore()} onInput={(e) => setBreedsOwnedBefore(e.currentTarget.value)} placeholder="T.ex. Labrador, Golden Retriever, blandras" />
          </div>
          <div class="form-group">
            <label for="phone">Telefon</label>
            <input id="phone" type="tel" value={phone()} onInput={(e) => setPhone(e.currentTarget.value)} />
          </div>
          {error() && <p style="color: #dc2626;">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()}>
            {loading() ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </OnboardingShell>
  );
}
