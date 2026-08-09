export function boatsNeeded(passengers: number, seatCount: number): number {
  if (!Number.isFinite(passengers) || passengers < 1) {
    throw new Error('จำนวนผู้โดยสารต้องมีอย่างน้อย 1 คน');
  }
  if (!Number.isFinite(seatCount) || seatCount < 1) {
    throw new Error('ที่นั่งต่อลำไม่ถูกต้อง');
  }
  return Math.ceil(passengers / seatCount);
}

export function lineSubtotal(unitPrice: number, boatCount: number): number {
  return Number(unitPrice) * boatCount;
}

export function sumPassengerCounts(
  items: Array<{ num_passengers: number }>
): number {
  return items.reduce((sum, item) => sum + Number(item.num_passengers || 0), 0);
}

export function sumSubtotals(subtotals: number[]): number {
  return subtotals.reduce((a, b) => a + b, 0);
}
