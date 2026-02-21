import { A, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { getOnboardingUserType, isSitterOnly } from "~/lib/onboarding";
import { geocodeAddress } from "~/lib/geocode";
import { parseApiError } from "~/lib/errors";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";
import { OnboardingShell } from "~/components/OnboardingShell";
import { Avatar } from "~/components/Avatar";
import { SwedishAddressInput, type AddressValue } from "~/components/SwedishAddressInput";

export default function OnboardingProfile() {
  const nav = useNavigate();
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal<Partial<AddressValue>>({});
  const [bio, setBio] = createSignal("");
  const [breedsOwnedBefore, setBreedsOwnedBefore] = createSignal("");
  const [avatarFile, setAvatarFile] = createSignal<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = createSignal<string | undefined>();
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    const file = avatarFile();
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreviewUrl(url);
      onCleanup(() => URL.revokeObjectURL(url));
    } else {
      setAvatarPreviewUrl(undefined);
    }
  });
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
    if (!getOnboardingUserType()) {
      nav("/onboarding/choice", { replace: true });
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
      setBio(user.bio ?? "");
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
        const form = e.target as HTMLFormElement;
        const street = form.querySelector<HTMLInputElement>("#address-line1")?.value?.trim();
        const postalCode = form.querySelector<HTMLInputElement>("#postal-code")?.value?.trim();
        const city = form.querySelector<HTMLInputElement>("#address-level2")?.value?.trim();
        const raw = [street, postalCode, city].filter(Boolean).join(", ");
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
        setError("Ange en giltig adress.");
        setLoading(false);
        return;
      }
      if (!name().trim()) {
        setError("Fyll i ditt namn.");
        setLoading(false);
        return;
      }

      const areaVal = addr.area ?? ([addr.city, addr.neighborhood].filter(Boolean).join(" - ") || "");
      const file = avatarFile();
      if (file) {
        const fd = new FormData();
        fd.append("name", name());
        fd.append("phone", phone() || "");
        fd.append("area", areaVal);
        fd.append("city", addr.city ?? "");
        fd.append("neighborhood", addr.neighborhood ?? "");
        fd.append("address_private", addr.address_private ?? "");
        fd.append("latitude", String(addr.latitude ?? ""));
        fd.append("longitude", String(addr.longitude ?? ""));
        fd.append("bio", bio() || "");
        fd.append("breeds_owned_before", breedsOwnedBefore() || "");
        fd.append("avatar", file);
        const updated = await pb.collection("users").update(userId, fd);
        pb.authStore.save(pb.authStore.token!, { ...pb.authStore.model, ...updated });
      } else {
        await pb.collection("users").update(userId, {
          name: name(),
          phone: phone(),
          area: areaVal,
          city: addr.city,
          neighborhood: addr.neighborhood,
          address_private: addr.address_private,
          latitude: addr.latitude,
          longitude: addr.longitude,
          bio: bio() || undefined,
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
        bio: bio(),
        breeds_owned_before: breedsOwnedBefore(),
        });
      }
      nav(isSitterOnly() ? "/onboarding/capacity" : "/onboarding/dogs");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell step={1} totalSteps={isSitterOnly() ? 2 : 4} title="Din profil">
      <div class="card">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <Avatar
            name={name()}
            city={address().city}
            neighborhood={address().neighborhood}
            id={pb.authStore.model?.id}
            avatar={avatarFile() ? undefined : pb.authStore.model?.avatar}
            src={avatarPreviewUrl()}
            baseUrl={import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090"}
          />
        </div>
        <form onSubmit={handleSubmit}>
          <ImageCaptureInput
            id="avatar"
            label="Profilbild (valfritt)"
            variant="profile"
            value={avatarFile()}
            onInput={setAvatarFile}
            existingUrl={
              pb.authStore.model?.avatar && pb.authStore.model?.id
                ? `${import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090"}/api/files/users/${pb.authStore.model.id}/${pb.authStore.model.avatar}`
                : undefined
            }
            hint="På mobil: ta selfie eller välj från galleri. På dator: dra och släpp eller klicka för att välja."
          />
          <p style="color: var(--color-text-muted); margin-bottom: 1rem;">
            Vi riktar oss till Sverige. Din adress hjälper att hitta matchningar i närheten. Din fullständiga adress visas bara när ni kopplar ihop.
          </p>
          <div class="form-group">
            <label for="name">Namn *</label>
            <input id="name" type="text" value={name()} onInput={(e) => setName(e.currentTarget.value)} required placeholder="Ditt namn" autocomplete="name" />
          </div>
          <SwedishAddressInput value={address()} onSelect={setAddress} />
          <div class="form-group">
            <label for="bio">Bio (valfritt)</label>
            <textarea id="bio" value={bio()} onInput={(e) => setBio(e.currentTarget.value)} placeholder="Berätta lite om dig och din erfarenhet med hundar" rows={3} />
          </div>
          <div class="form-group">
            <label for="breeds_owned_before">Vilka hundraser har du tidigare haft erfarenhet av?</label>
            <input id="breeds_owned_before" type="text" value={breedsOwnedBefore()} onInput={(e) => setBreedsOwnedBefore(e.currentTarget.value)} placeholder="T.ex. Labrador, Golden Retriever, blandras" />
          </div>
          <div class="form-group">
            <label for="phone">Telefon *</label>
            <input id="phone" type="tel" value={phone()} onInput={(e) => setPhone(e.currentTarget.value)} required placeholder="070-123 45 67" autocomplete="tel" />
          </div>
          {error() && <p class="form-error" role="alert">{error()}</p>}
          <button type="submit" class="btn" disabled={loading()}>
            {loading() ? "Sparar..." : "Fortsätt"}
          </button>
        </form>
      </div>
    </OnboardingShell>
  );
}
