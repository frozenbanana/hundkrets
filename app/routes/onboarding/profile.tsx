import { A, useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { geocodeAddress } from "~/lib/geocode";
import { OnboardingShell } from "~/components/OnboardingShell";
import { Avatar } from "~/components/Avatar";
import { AddressAutocomplete, type AddressValue } from "~/components/AddressAutocomplete";

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
    if (pb.authStore.model?.area) {
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
        const input = (e.target as HTMLFormElement).querySelector<HTMLInputElement>("#address");
        const raw = input?.value?.trim();
        if (raw) {
          const geocoded = await geocodeAddress(raw);
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
        setError("Please select an address from the suggestions or enter a valid address.");
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
          Tell us about yourself. Your address helps find nearby matches. Your full address stays private until you connect with someone.
        </p>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name">Name</label>
            <input id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
          </div>
          <AddressAutocomplete value={address()} onSelect={setAddress} />
          <div class="form-group">
            <label for="breeds_owned_before">Which dog breeds have you owned before?</label>
            <input id="breeds_owned_before" type="text" value={breedsOwnedBefore()} onInput={(e) => setBreedsOwnedBefore(e.currentTarget.value)} placeholder="e.g. Labrador, Golden Retriever, mixed breeds" />
          </div>
          <div class="form-group">
            <label for="phone">Phone</label>
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
