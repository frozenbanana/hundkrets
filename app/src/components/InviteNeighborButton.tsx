import { createSignal } from "solid-js";
import { shareInvite } from "~/lib/invite";

export function InviteNeighborButton(props: {
  class?: string;
  variant?: "primary" | "secondary";
}) {
  const [busy, setBusy] = createSignal(false);

  async function onClick() {
    setBusy(true);
    try {
      await shareInvite();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        /* toast already shown for clipboard failures in shareInvite, or skip abort */
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      class={props.variant === "secondary" ? "btn btn-secondary" : "btn"}
      classList={{ [props.class!]: !!props.class }}
      disabled={busy()}
      onClick={onClick}
      data-umami-event="Invite neighbor"
    >
      {busy() ? "Delar…" : "Bjud in en granne"}
    </button>
  );
}
