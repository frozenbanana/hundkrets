let configured = false;
const LEAFLET_CDN_BASE = "https://unpkg.com/leaflet@1.9.4/dist/images";

/**
 * Leaflet default marker icons use relative URLs that often break in production builds.
 * Point them to Vite-bundled asset URLs once per runtime.
 */
export function configureLeafletDefaultIcons(
  L: typeof import("leaflet")
): void {
  if (configured) return;
  configured = true;

  // Leaflet sets these paths internally; removing forces our explicit URLs below.
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: `${LEAFLET_CDN_BASE}/marker-icon-2x.png`,
    iconUrl: `${LEAFLET_CDN_BASE}/marker-icon.png`,
    shadowUrl: `${LEAFLET_CDN_BASE}/marker-shadow.png`,
  });
}
