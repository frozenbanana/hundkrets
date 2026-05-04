/**
 * Umami analytics helper for programmatic event tracking.
 * Falls back gracefully if Umami is not loaded or blocked.
 */

export function trackUmami(
  eventName: string,
  data?: Record<string, string | number | boolean | undefined>
) {
  const umami = (window as unknown as { umami?: { track: (event: string, data?: Record<string, unknown>) => void } }).umami;
  if (!umami?.track) return;
  try {
    umami.track(eventName, data ?? {});
  } catch {
    // Silently ignore tracking errors
  }
}
