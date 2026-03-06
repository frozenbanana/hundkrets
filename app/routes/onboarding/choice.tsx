import { useNavigate } from "@solidjs/router";
import { showToast } from "~/lib/toast";
import { createSignal, onMount } from "solid-js";
import { pb } from "~/lib/pocketbase";
import { setOnboardingUserType, isReceiverOnly, isSitterOnly } from "~/lib/onboarding";
import { geocodePostalCode } from "~/lib/geocode";
import { parseApiError } from "~/lib/errors";
import { OnboardingShell } from "~/components/OnboardingShell";
import { PostalCodeInput, type PostalCodeValue } from "~/components/PostalCodeInput";
import { ValidatedInput } from "~/components/ValidatedInput";

export default function OnboardingChoice() {
  const nav = useNavigate();
  const [userType, setUserType] = createSignal<"has_dogs" | "sitter_only" | "receiver_only" | null>(null);
  const [name, setName] = createSignal("");
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
      setAddress({
        address_private: user.address_private,
        latitude: user.latitude,
        longitude: user.longitude,
        city: user.city,
        neighborhood: user.neighborhood,
        area: user.area,
      });
    }
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

      let addr = address();
      if (!addr.latitude || !addr.longitude) {
        const form = e.target as HTMLFormElement;
        const postalInput = form.querySelector<HTMLInputElement>("#postal-code")?.value?.trim();
        if (postalInput) {
          const geocoded = await geocodePostalCode(postalInput);
          if (geocoded) {
            const area = geocoded.city || geocoded.neighborhood || geocoded.display_name || "";
            addr = {
              address_private: `Postnummer ${postalInput}, ${area}`.trim(),
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
        setError("Ange ett giltigt postnummer.");
        setLoading(false);
        return;
      }
      if (!name().trim()) {
        setError("Fyll i ditt namn.");
        setLoading(false);
        return;
      }

      const areaVal = addr.area ?? ([addr.city, addr.neighborhood].filter(Boolean).join(" - ") || "");
      await pb.collection("users").update(userId, {
        name: name(),
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
      totalSteps={userType() ? (isSitterOnly() ? 2 : isReceiverOnly() ? 3 : 4) : 4}
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
                <PostalCodeInput id="postal-code" value={address()} onSelect={setAddress} />
              </section>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button type="submit" class="btn" disabled={loading()}>
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
              >
                <span style="font-size: 2rem;">🐕↔️🐕</span>
                <strong>Byta hundpassning</strong>
              </button>
              <button
                type="button"
                class="btn btn-receiver"
                onClick={() => handleChoice("receiver_only")}
                style="text-align: left; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;"
              >
                <span style="font-size: 2rem;">🤝</span>
                <strong>Endast ta emot passning</strong>
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                onClick={() => handleChoice("sitter_only")}
                style="text-align: left; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;"
              >
                <span style="font-size: 2rem;">🚶‍♂️🐕</span>
                <strong>Endast passa hundar</strong>
              </button>
            </div>
          </>
        )}
      </div>
    </OnboardingShell>
  );
}
