import { normalizeAuthEmail } from './auth-email';

export interface GoogleEmailEntry {
  value?: string;
  verified?: boolean;
}

export interface GoogleNameParts {
  givenName?: string;
  familyName?: string;
}

export interface GoogleProfileJson {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
}

export interface GoogleProfileLike {
  id?: string;
  displayName?: string;
  name?: GoogleNameParts;
  emails?: GoogleEmailEntry[];
  photos?: Array<{ value?: string }>;
  _json?: GoogleProfileJson;
}

const NAME_MAX = 100;

// ตัดช่องว่างและจำกัดความยาวชื่อไม่ให้เกินขนาดคอลัมน์ในฐานข้อมูล
function clipName(value: string): string {
  return value.trim().slice(0, NAME_MAX);
}

// ตรวจสอบและแปลงรูปแบบอีเมลให้เป็นมาตรฐานเดียวกัน
function normalizeEmail(value: unknown): string | null {
  const email = normalizeAuthEmail(String(value ?? ""));
  if (!email.includes("@") || email.length > 100) return null;
  return email;
}

// ดึงอีเมลที่ได้รับการยืนยันแล้วจากโปรไฟล์ Google
export function extractGoogleEmail(profile: GoogleProfileLike): string | null {
  const verified = profile.emails?.find((entry) => entry.verified && entry.value);
  const jsonEmail = profile._json?.email_verified === true ? profile._json?.email : undefined;
  const candidates: unknown[] = [verified?.value, jsonEmail];
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate);
    if (email) return email;
  }
  return null;
}

// ดึง URL รูปโปรไฟล์จากข้อมูลบัญชี Google
export function extractGoogleAvatar(profile: GoogleProfileLike): string | null {
  const photo = profile.photos?.[0]?.value || profile._json?.picture || "";
  const trimmed = photo.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// แยกชื่อจริงและนามสกุลจากโปรไฟล์ Google หรือใช้ชื่อจากอีเมลแทน
export function extractGoogleName(
  profile: GoogleProfileLike,
  email: string,
): { firstName: string; lastName: string } {
  const given = clipName(
    profile.name?.givenName || profile._json?.given_name || "",
  );
  const family = clipName(
    profile.name?.familyName || profile._json?.family_name || "",
  );
  if (given || family) {
    return {
      firstName: given || clipName(email.split("@")[0] || "สมาชิก"),
      lastName: family,
    };
  }

  const display = clipName(profile.displayName || profile._json?.name || "");
  if (display) {
    const parts = display.split(/\s+/);
    return {
      firstName: clipName(parts[0] || email.split("@")[0] || "สมาชิก"),
      lastName: clipName(parts.slice(1).join(" ")),
    };
  }

  return {
    firstName: clipName(email.split("@")[0] || "สมาชิก"),
    lastName: "",
  };
}
