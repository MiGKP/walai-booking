export interface LatLng {
  lat: number;
  lng: number;
}

// แปลงข้อความพิกัดละติจูดและลองจิจูดเป็นอ็อบเจกต์ตัวเลข
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

// สร้าง URL สำหรับฝังแผนที่ Google Maps จากพิกัดละติจูดและลองจิจูด
export function googleMapsEmbedUrl(coords: LatLng, zoom = 16): string {
  const q = `${coords.lat},${coords.lng}`;
  const encoded = encodeURIComponent(q);
  return `https://maps.google.com/maps?q=${encoded}&ll=${encoded}&z=${zoom}&t=k&hl=th&output=embed`;
}

// สร้าง URL สำหรับฝังแผนที่ Google Maps จากคำค้นหาสถานที่
export function googleMapsSearchUrl(query: string, zoom = 16): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&t=k&hl=th&output=embed`;
}
