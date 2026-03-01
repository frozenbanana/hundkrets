import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { geocodeAddress } from "~/lib/geocode";
import { parseApiError } from "~/lib/errors";
import { AppShell } from "~/components/AppShell";
import { Avatar } from "~/components/Avatar";
import { ImageCaptureInput } from "~/components/ImageCaptureInput";
import { SwedishAddressInput, type AddressValue } from "~/components/SwedishAddressInput";

export default function Profile() {
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
  const [saved, setSaved] = createSignal(false);
  const [chatEmailFrequency, setChatEmailFrequency] = createSignal<"instant" | "daily" | "off">("daily");

  // Inställningar: byt e-post
  const [newEmail, setNewEmail] = createSignal("");
  const [emailChangeModalOpen, setEmailChangeModalOpen] = createSignal(false);
  const [emailChangeConfirmInput, setEmailChangeConfirmInput] = createSignal("");
  const [emailChangeLoading, setEmailChangeLoading] = createSignal(false);
  const [emailChangeError, setEmailChangeError] = createSignal("");

  // Inställningar: ta bort konto
  const [deleteModalOpen, setDeleteModalOpen] = createSignal(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = createSignal("");
  const [deleteLoading, setDeleteLoading] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
  const currentEmail = () => (pb.authStore.model?.email as string) ?? "";
  const emailMatches = (input: string) =>
    input.trim().toLowerCase() === currentEmail().toLowerCase();

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
      const pref = (user.chat_email_frequency as "instant" | "daily" | "off" | undefined) ?? "daily";
      setChatEmailFrequency(pref === "daily" || pref === "off" ? pref : "instant");
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
        fd.append("chat_email_frequency", chatEmailFrequency());
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
          chat_email_frequency: chatEmailFrequency(),
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
          chat_email_frequency: chatEmailFrequency(),
        });
      }
      setSaved(true);
      showToast("Profil sparad");
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }

  function openEmailChangeModal() {
    const email = newEmail().trim();
    if (!email) {
      setError("Ange din nya e-postadress.");
      return;
    }
    setEmailChangeError("");
    setEmailChangeConfirmInput("");
    setEmailChangeModalOpen(true);
  }

  function closeEmailChangeModal() {
    setEmailChangeModalOpen(false);
    setEmailChangeConfirmInput("");
    setEmailChangeError("");
  }

  async function confirmEmailChange() {
    if (!emailMatches(emailChangeConfirmInput())) return;
    setEmailChangeLoading(true);
    setEmailChangeError("");
    try {
      await pb.collection("users").requestEmailChange(newEmail().trim());
      closeEmailChangeModal();
      setNewEmail("");
      showToast("Vi har skickat en bekräftelselänk till din nya e-postadress");
    } catch (err: unknown) {
      setEmailChangeError(parseApiError(err));
    } finally {
      setEmailChangeLoading(false);
    }
  }

  function openDeleteModal() {
    setDeleteError("");
    setDeleteConfirmInput("");
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeleteConfirmInput("");
    setDeleteError("");
  }

  async function confirmDeleteAccount() {
    if (!emailMatches(deleteConfirmInput())) return;
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await pb.collection("users").delete(userId);
      pb.authStore.clear();
      showToast("Ditt konto har tagits bort");
      nav("/", { replace: true });
    } catch (err: unknown) {
      setDeleteError(parseApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <AppShell>
    <div class="container">
      <div class="page-hero">
        <span class="paw-emoji">👤</span>
        <h1>Profil</h1>
        <div style="text-align: center; margin: 1rem 0;">
          <Avatar
            name={name()}
            city={address().city}
            neighborhood={address().neighborhood}
            id={pb.authStore.model?.id}
            avatar={avatarFile() ? undefined : pb.authStore.model?.avatar}
            src={avatarPreviewUrl()}
            baseUrl={baseUrl}
            verified={(pb.authStore.model as { verified?: boolean } | null)?.verified}
          />
        </div>
      </div>
      <div class="card">
      <p style="color: var(--color-text-muted); margin-bottom: 1rem;">Din adress hjälper att hitta matchningar i närheten. Din fullständiga adress visas bara när ni kopplar ihop.</p>
      <form onSubmit={handleSubmit}>
        <ImageCaptureInput
          id="avatar"
          label="Profilbild (valfritt)"
          variant="profile"
          value={avatarFile()}
          onInput={setAvatarFile}
          existingUrl={
            pb.authStore.model?.avatar && pb.authStore.model?.id
              ? `${baseUrl}/api/files/users/${pb.authStore.model.id}/${pb.authStore.model.avatar}`
              : undefined
          }
          hint="På mobil: ta selfie eller välj från galleri. På dator: dra och släpp eller klicka för att välja."
        />
        <div class="form-group">
          <label for="name">Namn *</label>
          <input
            id="name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            required
            placeholder="Ditt namn"
            autocomplete="name"
          />
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
          <input
            id="phone"
            type="tel"
            value={phone()}
            onInput={(e) => setPhone(e.currentTarget.value)}
            required
            placeholder="070-123 45 67"
            autocomplete="tel"
          />
        </div>
        {error() && <p class="form-error" role="alert">{error()}</p>}
        <button type="submit" class="btn" disabled={loading()}>
          {loading() ? "Sparar..." : "Spara profil"}
        </button>
      </form>
      </div>

      <div class="card">
        <h2 style="margin: 0 0 1rem; font-size: 1.25rem;">Inställningar</h2>

        <div class="form-group">
          <label for="chat-email-frequency">E-post för chattmeddelanden</label>
          <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0.25rem 0 0.5rem;">
            Välj hur ofta du vill få e-post när någon skriver till dig.
          </p>
          <select
            id="chat-email-frequency"
            value={chatEmailFrequency()}
            onChange={(e) => setChatEmailFrequency(e.currentTarget.value as "instant" | "daily" | "off")}
          >
            <option value="instant">Direkt</option>
            <option value="daily">Daglig sammanfattning</option>
            <option value="off">Av</option>
          </select>
        </div>

        <div class="form-group">
          <label for="new-email">Byt e-postadress</label>
          <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0.25rem 0 0.5rem;">
            Du får en bekräftelselänk till din nya e-post innan ändringen träder i kraft.
          </p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <input
              id="new-email"
              type="email"
              value={newEmail()}
              onInput={(e) => setNewEmail(e.currentTarget.value)}
              placeholder="ny@epost.se"
              autocomplete="email"
              style="flex: 1; min-width: 200px;"
            />
            <button type="button" class="btn btn-secondary" onClick={openEmailChangeModal} disabled={!newEmail().trim()}>
              Byt e-post
            </button>
          </div>
        </div>

        <div class="danger-zone">
          <h3 style="margin: 0 0 0.5rem; color: #dc2626; font-size: 1rem;">Ta bort konto</h3>
          <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0 0 1rem;">
            Detta tar permanent bort ditt konto och all tillhörande data. Denna åtgärd kan inte ångras.
          </p>
          <button type="button" class="btn btn-danger" onClick={openDeleteModal}>
            Ta bort mitt konto
          </button>
        </div>
      </div>
    </div>

    <Show when={emailChangeModalOpen()}>
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="email-change-modal-title" onClick={closeEmailChangeModal}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <h2 id="email-change-modal-title" style="margin: 0;">Bekräfta e-postbyte</h2>
            <button type="button" class="match-detail-close" onClick={closeEmailChangeModal} aria-label="Stäng">×</button>
          </div>
          <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
            Skriv din e-postadress för att bekräfta att du vill byta till {newEmail().trim()}.
          </p>
          <div class="form-group">
            <label for="email-change-confirm">Din e-postadress</label>
            <input
              id="email-change-confirm"
              type="email"
              value={emailChangeConfirmInput()}
              onInput={(e) => setEmailChangeConfirmInput(e.currentTarget.value)}
              placeholder={currentEmail()}
              autocomplete="email"
            />
          </div>
          {emailChangeError() && <p class="form-error" role="alert">{emailChangeError()}</p>}
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" onClick={closeEmailChangeModal}>
              Avbryt
            </button>
            <button
              type="button"
              class="btn"
              disabled={!emailMatches(emailChangeConfirmInput()) || emailChangeLoading()}
              onClick={confirmEmailChange}
            >
              {emailChangeLoading() ? "Skickar..." : "Bekräfta"}
            </button>
          </div>
        </div>
      </div>
    </Show>

    <Show when={deleteModalOpen()}>
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" onClick={closeDeleteModal}>
        <div class="modal" onClick={(e) => e.stopPropagation()}>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <h2 id="delete-modal-title" style="margin: 0; color: #dc2626;">Ta bort konto</h2>
            <button type="button" class="match-detail-close" onClick={closeDeleteModal} aria-label="Stäng">×</button>
          </div>
          <p style="color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.95rem;">
            Skriv din e-postadress för att bekräfta att du vill ta bort ditt konto permanent.
          </p>
          <div class="form-group">
            <label for="delete-confirm">Din e-postadress</label>
            <input
              id="delete-confirm"
              type="email"
              value={deleteConfirmInput()}
              onInput={(e) => setDeleteConfirmInput(e.currentTarget.value)}
              placeholder={currentEmail()}
              autocomplete="email"
            />
          </div>
          {deleteError() && <p class="form-error" role="alert">{deleteError()}</p>}
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" onClick={closeDeleteModal} disabled={deleteLoading()}>
              Avbryt
            </button>
            <button
              type="button"
              class="btn btn-danger"
              disabled={!emailMatches(deleteConfirmInput()) || deleteLoading()}
              onClick={confirmDeleteAccount}
            >
              {deleteLoading() ? "Tar bort..." : "Ta bort konto"}
            </button>
          </div>
        </div>
      </div>
    </Show>
    </AppShell>
  );
}
