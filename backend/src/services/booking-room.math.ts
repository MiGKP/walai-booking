// คำนวณจำนวนคืนที่เข้าพักจากวันเช็คอินและเช็คเอาท์
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`);
  const b = new Date(`${checkOut}T00:00:00Z`);
  const nights = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (!Number.isFinite(nights) || nights < 1) {
    throw new Error('check_out_date must be after check_in_date');
  }
  return nights;
}

// คำนวณความจุผู้เข้าพักรวมของห้องที่เลือกทั้งหมด
export function sumCapacity(
  items: Array<{ capacity: number; quantity: number }>
): number {
  return items.reduce((sum, item) => sum + item.capacity * item.quantity, 0);
}

// เกณฑ์อายุเด็กเล็กที่เข้าพักฟรีโดยไม่นับรวมในความจุห้อง
export const INFANT_MAX_AGE_EXCLUSIVE = 6;

// นับจำนวนเด็กที่มีอายุถึงเกณฑ์ต้องนับรวมในความจุห้องพัก
export function countCapacityChildren(
  childAges: number[],
  infantMaxAgeExclusive: number = INFANT_MAX_AGE_EXCLUSIVE
): number {
  return childAges.filter((age) => age >= infantMaxAgeExclusive).length;
}

// ตรวจสอบว่าจำนวนผู้ใหญ่และเด็กไม่เกินความจุห้องพักและสิทธิ์เสริมของเด็ก
export function assertGuestsFitCapacity(
  adults: number,
  children: number,
  capacitySum: number,
  additionalChildPlaces: number = 0
): void {
  const total = adults + children;
  if (adults < 1) {
    throw new Error('ต้องมีผู้ใหญ่อย่างน้อย 1 คน');
  }
  const allowance = Math.min(children, Math.max(0, additionalChildPlaces));
  if (adults > capacitySum || total > capacitySum + allowance) {
    throw new Error(
      `ผู้เข้าพักรวม ${total} คน เกินความจุหลัก ${capacitySum} คนและสิทธิ์เด็ก 6–11 ปีเพิ่มเติม ${allowance} คน (ไม่เกิน 1 คนต่อห้อง)`
    );
  }
}

// คำนวณจำนวนสิทธิ์พักเสริมสำหรับเด็กอายุ 6-11 ปี (สูงสุดไม่เกินจำนวนห้องที่จอง)
export function childOvercapacityAllowance(
  childAges: number[],
  roomCount: number,
  infantMaxAgeExclusive: number = INFANT_MAX_AGE_EXCLUSIVE
): number {
  return Math.min(roomCount, childAges.filter(age => Number.isInteger(age) && age >= Math.max(6, infantMaxAgeExclusive) && age <= 11).length);
}

// คำนวณราคารวมย่อยต่อห้องจากราคาต่อคืนและจำนวนคืน
export function lineSubtotal(pricePerNight: number, nights: number): number {
  return Number(pricePerNight) * nights;
}

// รวมยอดเงินย่อยทั้งหมดของทุกห้อง
export function sumSubtotals(subtotals: number[]): number {
  return subtotals.reduce((a, b) => a + b, 0);
}
