export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`);
  const b = new Date(`${checkOut}T00:00:00Z`);
  const nights = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (!Number.isFinite(nights) || nights < 1) {
    throw new Error('check_out_date must be after check_in_date');
  }
  return nights;
}

export function sumCapacity(
  items: Array<{ capacity: number; quantity: number }>
): number {
  return items.reduce((sum, item) => sum + item.capacity * item.quantity, 0);
}

// เด็กอายุ 0-5 ขวบ เข้าพักฟรีไม่นับความจุห้อง
export const INFANT_MAX_AGE_EXCLUSIVE = 6;

export function countCapacityChildren(childAges: number[]): number {
  return childAges.filter((age) => age >= INFANT_MAX_AGE_EXCLUSIVE).length;
}

export function assertGuestsFitCapacity(
  adults: number,
  children: number,
  capacitySum: number
): void {
  const total = adults + children;
  if (adults < 1) {
    throw new Error('ต้องมีผู้ใหญ่อย่างน้อย 1 คน');
  }
  if (total > capacitySum) {
    throw new Error(
      `ผู้เข้าพักรวม ${total} คน เกินความจุรวม ${capacitySum} คน`
    );
  }
}

export function lineSubtotal(pricePerNight: number, nights: number): number {
  return Number(pricePerNight) * nights;
}

export function sumSubtotals(subtotals: number[]): number {
  return subtotals.reduce((a, b) => a + b, 0);
}
