import { showToast } from "~/lib/toast";

export function inviteRegisterUrl(siteOrigin: string): string {
  return `${String(siteOrigin).replace(/\/$/, "")}/register?utm_source=invite&utm_medium=share&utm_campaign=neighbor`;
}

/** Register URL for neighbor invites (Facebook/local-group style). */
export function inviteUrl(): string {
  const base =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
    (typeof window !== "undefined" ? window.location.origin : "https://hundkrets.se");
  return inviteRegisterUrl(String(base));
}

export const INVITE_TEXT =
  "Byt hundpassning med grannar — helt gratis. Ju fler i närheten, desto lättare att hitta någon.";

export async function shareInvite(): Promise<"shared" | "copied"> {
  const url = inviteUrl();
  const text = `${INVITE_TEXT} ${url}`;
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Hundkrets", text: INVITE_TEXT, url });
      showToast("Tack — bjud in fler i närheten!");
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
    }
  }
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("clipboard unavailable");
    }
    await navigator.clipboard.writeText(text);
    showToast("Inbjudan kopierad. Skicka den till en hundägare i närheten.");
    return "copied";
  } catch {
    showToast("Kunde inte dela inbjudan.", "error");
    throw new Error("Kunde inte dela inbjudan.");
  }
}
