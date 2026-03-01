import { pb } from "~/lib/pocketbase";

export function isUserVerified(): boolean {
  const m = pb.authStore.model as { verified?: boolean } | null;
  return m?.verified === true;
}
