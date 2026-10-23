// แปลงอีเมลเป็นตัวพิมพ์เล็กและตัดช่องว่างหน้า-หลัง
export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

// แปลงอีเมล Gmail แบบเดิม (ตัดจุดและเครื่องหมายบวก) เพื่อรองรับการค้นหาบัญชีเก่า
export function legacyAuthEmail(value: string): string {
  const email = normalizeAuthEmail(value);
  const [local, domain] = email.split('@');
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return email;
  return `${local.split('+')[0].replace(/\./g, '')}@gmail.com`;
}
