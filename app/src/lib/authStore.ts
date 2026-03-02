import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";

/** Signal that increments when auth data is refreshed – use to trigger re-renders after authRefresh */
export const [authVersion, setAuthVersion] = createSignal(0);

/** Refresh auth from server to get latest user data (e.g. after email verification). */
export async function refreshAuth(): Promise<void> {
  if (!pb.authStore.isValid) return;
  await pb.collection("users").authRefresh();
  setAuthVersion((v) => v + 1);
}
