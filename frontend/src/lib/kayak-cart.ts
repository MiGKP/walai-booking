export interface KayakCartLine {
  boat_type_id: number;
  name: string;
  capacity: number;
  price_per_hour: number;
  num_passengers: number;
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
    const count = boatsNeeded(line.num_passengers, line.capacity);
    return sum + lineSubtotal(line.price_per_hour, count);
  }, 0);
}

export function cartPassengerTotal(lines: KayakCartLine[]): number {
  return lines.reduce((sum, line) => sum + Number(line.num_passengers || 0), 0);
}

export function cartBoatTotal(lines: KayakCartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + boatsNeeded(line.num_passengers, line.capacity),
    0
  );
}

export function slotKey(startTime: string, endTime: string): string {
  return `${String(startTime).slice(0, 8)}|${String(endTime).slice(0, 8)}`;
}
