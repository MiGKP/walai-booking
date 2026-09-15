export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Parse "lat, lng" from admin resort settings.
 * If values look swapped (lng pasted first), swap them.
 */
export function parseLatLng(raw: string | undefined | null): LatLng | null {
  if (raw == null) return null;
  const match = String(raw)
    .trim()
    .match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  let lat = Number(match[1]);
  let lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    const swapped = lat;
    lat = lng;
    lng = swapped;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Google embed that centers on the pin (not a place-name search box). */
export function googleMapsEmbedUrl(coords: LatLng, zoom = 16): string {
  const q = `${coords.lat},${coords.lng}`;
  const encoded = encodeURIComponent(q);
  return `https://maps.google.com/maps?q=${encoded}&ll=${encoded}&z=${zoom}&hl=th&output=embed`;
}

export function googleMapsSearchUrl(query: string, zoom = 16): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&hl=th&output=embed`;
}
