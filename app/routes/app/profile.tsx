import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { geocodeAddress } from "~/lib/geocode";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";
import { SwedishAddressInput, type AddressValue } from "~/components/SwedishAddressInput";

export default function Profile() {
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal<Partial<AddressValue>>({});
  const [bio, setBio] = createSignal("");
  const [breedsOwnedBefore, setBreedsOwnedBefore] = createSignal("");
  const [avatarFile, setAvatarFile] = createSignal<File | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [saved, setSaved] = createSignal(false);

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";

  onMount(() => {
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
    setSaved(false);
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
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">👤</span>
        <h1>Profile</h1>
        <div style="text-align: center; margin: 1rem 0;">
          <Avatar
            name={name()}
            city={address().city}
            neighborhood={address().neighborhood}
            id={pb.authStore.model?.id}
            avatar={avatarFile() ? undefined : pb.authStore.model?.avatar}
            baseUrl={baseUrl}
          />
        </div>
      </div>
      <div class="card">
      <p style="color: var(--color-text-muted); margin-bottom: 1rem;">Din adress hjälper att hitta matchningar i närheten. Din fullständiga adress visas bara när ni kopplar ihop.</p>
      <form onSubmit={handleSubmit}>
        <ImageCaptureInput
          id="avatar"
          label="Profilbild (valfritt)"
          capture="user"
          value={avatarFile()}
          onInput={setAvatarFile}
          existingUrl={
            pb.authStore.model?.avatar && pb.authStore.model?.id
              ? `${baseUrl}/api/files/users/${pb.authStore.model.id}/${pb.authStore.model.avatar}`
              : undefined
          }
          hint="På mobil: tryck för att ta ett selfie. På dator: dra och släpp eller klicka för att välja."
        />
        <div class="form-group">
          <label for="name">Namn</label>
          <input
            id="name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <SwedishAddressInput value={address()} onSelect={setAddress} />
        <div class="form-group">
          <label for="bio">Bio (valfritt)</label>
          <textarea id="bio" value={bio()} onInput={(e) => setBio(e.currentTarget.value)} placeholder="Berätta lite om dig och din erfarenhet med hundar" rows={3} />
        </div>
        <div class="form-group">
          <label for="breeds_owned_before">Vilka hundraser har du tidigare ägt?</label>
          <input id="breeds_owned_before" type="text" value={breedsOwnedBefore()} onInput={(e) => setBreedsOwnedBefore(e.currentTarget.value)} placeholder="T.ex. Labrador, Golden Retriever, blandras" />
        </div>
        <div class="form-group">
          <label for="phone">Telefon</label>
          <input
            id="phone"
            type="tel"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value)}
          />
        </div>
        {error() && <p style="color: #dc2626;">{error()}</p>}
        {saved() && <p style="color: #16a34a;">Profile saved.</p>}
        <button type="submit" class="btn" disabled={loading()}>
          {loading() ? "Saving..." : "Save profile"}
        </button>
      </form>
      </div>
    </div>
    </AppShell>
  );
}
