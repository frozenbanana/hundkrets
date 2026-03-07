import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { pb } from "~/lib/pocketbase";
import { showToast } from "~/lib/toast";
import { parseApiError } from "~/lib/errors";

export function ProfileSettingsSection() {
  const nav = useNavigate();
  const [chatEmailFrequency, setChatEmailFrequency] = createSignal<"instant" | "daily" | "off">("daily");

  const [newEmail, setNewEmail] = createSignal("");
  const [emailChangeModalOpen, setEmailChangeModalOpen] = createSignal(false);
  const [emailChangeConfirmInput, setEmailChangeConfirmInput] = createSignal("");
  const [emailChangeLoading, setEmailChangeLoading] = createSignal(false);
  const [emailChangeError, setEmailChangeError] = createSignal("");

  const [deleteModalOpen, setDeleteModalOpen] = createSignal(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = createSignal("");
  const [deleteLoading, setDeleteLoading] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");

  const currentEmail = () => (pb.authStore.model?.email as string) ?? "";
  const emailMatches = (input: string) =>
    input.trim().toLowerCase() === currentEmail().toLowerCase();

  onMount(() => {
    const user = pb.authStore.model;
    if (user) {
      const pref = (user.chat_email_frequency as "instant" | "daily" | "off" | undefined) ?? "daily";
      setChatEmailFrequency(pref === "daily" || pref === "off" ? pref : "instant");
    }
  });

  async function saveChatEmailFrequency(value: "instant" | "daily" | "off") {
    const userId = pb.authStore.model?.id;
    if (!userId) return;
    try {
      await pb.collection("users").update(userId, { chat_email_frequency: value });
      pb.authStore.save(pb.authStore.token!, { ...pb.authStore.model, chat_email_frequency: value });
      showToast("Sparat");
    } catch (err) {
      showToast(parseApiError(err), "error");
    }
  }

  function openEmailChangeModal() {
    const email = newEmail().trim();
    if (!email) {
      setEmailChangeError("Ange din nya e-postadress.");
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
    <>
      <section id="inställningar" class="profile-settings-section">
        <h2 class="profile-section-title">Kontoinställningar</h2>
        <div class="card">
          <h2 style="margin: 0 0 1rem; font-size: 1.25rem;">Konto</h2>

          <div class="form-group">
            <label for="chat-email-frequency">E-post för chattmeddelanden</label>
            <p style="color: var(--color-text-muted); font-size: 0.9rem; margin: 0.25rem 0 0.5rem;">
              Välj hur ofta du vill få e-post när någon skriver till dig.
            </p>
            <select
              id="chat-email-frequency"
              value={chatEmailFrequency()}
              onChange={(e) => {
                const v = e.currentTarget.value as "instant" | "daily" | "off";
                setChatEmailFrequency(v);
                saveChatEmailFrequency(v);
              }}
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
            <div class="settings-email-change-row">
              <input
                id="new-email"
                type="email"
                value={newEmail()}
                onInput={(e) => setNewEmail(e.currentTarget.value)}
                placeholder="ny@epost.se"
                autocomplete="email"
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
      </section>

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
    </>
  );
}
