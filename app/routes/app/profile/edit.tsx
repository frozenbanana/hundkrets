import { A, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";
import { geocodeCity, geocodePostalCode } from "~/lib/geocode";
import { lookupPostalCode } from "~/lib/postalCode";
import { Avatar } from "~/components/Avatar";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";
import { avatarSrc, uploadToR2 } from "~/lib/media";
import { LocationPicker } from "~/components/LocationPicker";
import { PostalCodeInput, type PostalCodeValue } from "~/components/PostalCodeInput";
import { ValidatedInput } from "~/components/ValidatedInput";

export default function EditProfile() {
  const nav = useNavigate();
  const [name, setName] = createSignal("");
  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal<Partial<PostalCodeValue>>({});
  const [bio, setBio] = createSignal("");
  const [breedsOwnedBefore, setBreedsOwnedBefore] = createSignal("");
  const [avatarFile, setAvatarFile] = createSignal<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = createSignal<string | undefined>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

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

  onMount(() => {
    if (!pb.authStore.isValid) {
      nav("/login", { replace: true });
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
      const file = avatarFile();
      let avatarKey: string | undefined;
      if (file) {
        const uploaded = await uploadToR2(file, { kind: "image", contentType: file.type || "image/jpeg" });
        avatarKey = uploaded.objectKey;
      }
      const updated = await pb.collection("users").update(userId, {
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
        ...(avatarKey ? { avatar_key: avatarKey } : {}),
      });
      pb.authStore.save(pb.authStore.token!, { ...pb.authStore.model, ...updated });
      showToast("Profil sparad");
      nav("/app/profile");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="container">
        <A href="/app/profile" class="profile-back-link" style="display: inline-block; margin-bottom: 1rem;">
          ← Tillbaka till Min profil
        </A>
        <h1 class="profile-page-title" style="margin-bottom: 1.5rem;">Redigera profil</h1>
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
              verified={(pb.authStore.model as { verified?: boolean } | null)?.verified}
            />
          </div>
          <form onSubmit={handleSubmit}>
            {error() && (
              <p class="form-error" role="alert" style="margin-bottom: 1rem;">
                {error()}
              </p>
            )}
            <section style="margin-bottom: 1.5rem;">
              <h2 style="font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--color-text);">
                Namn och område
              </h2>
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
              <Show when={address().latitude && address().longitude && !(address().latitude === 0 && address().longitude === 0)}>
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
            </section>

            <section style="margin-bottom: 1.5rem;">
              <h2 style="font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--color-text);">
                Kontakt
              </h2>
              <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: 0 0 0.75rem;">
                Din e-post delas med andra när ni matchar, så att ni kan kontakta varandra.
              </p>
              <div class="form-group">
                <label for="phone">Telefon (valfritt)</label>
                <p style="color: var(--color-text-muted); font-size: 0.875rem; margin: -0.5rem 0 0.5rem 0;">
                  Används så att andra kan ringa dig när ni har kopplat ihop. Delas inte med andra innan matchning.
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

            <section style="margin-bottom: 1.5rem;">
              <h2 style="font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--color-text);">
                Om dig
              </h2>
              <ImageCaptureInput
                id="avatar"
                label="Profilbild (valfritt)"
                variant="profile"
                value={avatarFile()}
                onInput={setAvatarFile}
                existingUrl={avatarSrc(
                  {
                    id: pb.authStore.model?.id,
                    avatar: pb.authStore.model?.avatar,
                    avatar_key: (pb.authStore.model as { avatar_key?: string } | null)?.avatar_key,
                  },
                  import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090"
                )}
                hint="På mobil: ta selfie eller välj från galleri. På dator: dra och släpp eller klicka för att välja."
              />
              <div class="form-group">
                <label for="bio">Bio (valfritt)</label>
                <textarea
                  id="bio"
                  value={bio()}
                  onInput={(e) => setBio(e.currentTarget.value)}
                  placeholder="Berätta lite om dig och din erfarenhet med hundar"
                  rows={3}
                />
              </div>
              <div class="form-group">
                <label for="breeds_owned_before">Vilka hundraser har du tidigare haft erfarenhet av?</label>
                <input
                  id="breeds_owned_before"
                  type="text"
                  value={breedsOwnedBefore()}
                  onInput={(e) => setBreedsOwnedBefore(e.currentTarget.value)}
                  placeholder="T.ex. Labrador, Golden Retriever, blandras"
                />
              </div>
            </section>

            <button type="submit" class="btn" disabled={loading()}>
              {loading() ? "Sparar..." : "Spara"}
            </button>
            <A href="/app/profile" class="btn btn-secondary" style="margin-left: 0.5rem;">
              Avbryt
            </A>
          </form>
        </div>
      </div>
  );
}
