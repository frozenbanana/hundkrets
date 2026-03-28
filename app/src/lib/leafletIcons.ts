import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

let configured = false;

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
    iconRetinaUrl: markerIcon2xUrl,
    iconUrl: markerIconUrl,
    shadowUrl: markerShadowUrl,
  });
}
