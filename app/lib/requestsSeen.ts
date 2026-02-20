import { createSignal } from "solid-js";
import { pb } from "~/lib/pocketbase";

const STORAGE_KEY = "matches_requests_seen_at";

export function getRequestsSeenAt(): string | null {
  const userId = pb.authStore.model?.id;
  if (!userId) return null;
  return localStorage.getItem(`${STORAGE_KEY}_${userId}`);
}

export function markRequestsSeen(): void {
  const userId = pb.authStore.model?.id;
  if (!userId) return;
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, new Date().toISOString());
  setRequestsSeenVersion((v) => v + 1);
}

export const [requestsSeenVersion, setRequestsSeenVersion] = createSignal(0);
