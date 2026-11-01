export interface KayakCartLine {
  boat_type_id: number;
  name: string;
  capacity: number;
  price_per_hour: number;
  num_passengers: number;
  boat_count: number;
  free_tickets_used: number;
}

// คำนวณจำนวนลำเรือขั้นต่ำที่ต้องใช้จากจำนวนผู้โดยสารและความจุเรือ
export function boatsNeeded(passengers: number, seatCount: number): number {
  if (!Number.isFinite(passengers) || passengers < 1) return 0;
  if (!Number.isFinite(seatCount) || seatCount < 1) return 0;
  return Math.ceil(passengers / seatCount);
}

// คำนวณราคารวมต่อรายการเรือจากราคาต่อลำและจำนวนลำ
export function lineSubtotal(unitPrice: number, boatCount: number): number {
  return Number(unitPrice) * boatCount;
}

// คำนวณยอดรวมสุทธิของตะกร้าเรือหลังหักสิทธิ์เรือฟรี
export function cartTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => {
    const gross = lineSubtotal(line.price_per_hour, line.boat_count);
    const discount = (line.free_tickets_used || 0) * line.price_per_hour;
    return sum + Math.max(0, gross - discount);
  }, 0);
}

// รวมจำนวนผู้โดยสารทั้งหมดในตะกร้าเรือ
export function cartPassengerTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.num_passengers || 0), 0);
}

// รวมจำนวนลำเรือทั้งหมดในตะกร้าเรือ
export function cartBoatTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.boat_count, 0);
}

// สร้างคีย์อ้างอิงรอบเวลาเรือจากเวลาเริ่มต้นและเวลาสิ้นสุด
export function slotKey(startTime: string, endTime: string): string {
  return `${String(startTime).slice(0, 8)}|${String(endTime).slice(0, 8)}`;
}
