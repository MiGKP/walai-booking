export interface KayakCartLine {
  boat_type_id: number;
  name: string;
  capacity: number;
  price_per_hour: number;
  num_passengers: number;
  /** จำนวนเรือที่จะใช้จริง — ปกติคำนวณอัตโนมัติจากผู้โดยสาร แต่ผู้ใช้ปรับเพิ่มเองได้ */
  boat_count: number;
  /** จำนวนบัตรพายเรือฟรีที่จะใช้กับบรรทัดนี้ (หักราคาลำละ 1 ใบ) */
  free_tickets_used: number;
}

export function boatsNeeded(passengers: number, seatCount: number): number {
  if (!Number.isFinite(passengers) || passengers < 1) return 0;
  if (!Number.isFinite(seatCount) || seatCount < 1) return 0;
  return Math.ceil(passengers / seatCount);
}

export function lineSubtotal(unitPrice: number, boatCount: number): number {
  return Number(unitPrice) * boatCount;
}

export function cartTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => {
    const gross = lineSubtotal(line.price_per_hour, line.boat_count);
    const discount = (line.free_tickets_used || 0) * line.price_per_hour;
    return sum + Math.max(0, gross - discount);
  }, 0);
}

export function cartPassengerTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.num_passengers || 0), 0);
}

export function cartBoatTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.boat_count, 0);
}

export function slotKey(startTime: string, endTime: string): string {
  return `${String(startTime).slice(0, 8)}|${String(endTime).slice(0, 8)}`;
}
