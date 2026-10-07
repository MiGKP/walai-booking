import type { Pool } from 'pg';
import { restoreBookingPromotions } from './promotion-ledger';

interface QueryClient { query: Pool['query']; }

export async function restoreBoatTicketRedemptions(client: QueryClient, boatBookingId: number): Promise<void> {
  const redemptions = await client.query(
    `DELETE FROM boat_ticket_redemptions WHERE boat_booking_id = $1 RETURNING member_boat_ticket_id, quantity`,
    [boatBookingId],
  );
  for (const row of redemptions.rows) {
    await client.query(
      `UPDATE member_boat_tickets SET used_tickets = used_tickets - $1 WHERE id = $2`,
      [row.quantity, row.member_boat_ticket_id],
    );
  }
}

// Callers own the parent room lock before locking its addons.
export async function cancelBoatAddonsForRoomBooking(
  client: QueryClient, roomBookingId: number, previousRoomStatus?: string,
): Promise<void> {
  const addons = await client.query(
    `SELECT boat_booking_id, status, total_price FROM boat_bookings
     WHERE room_booking_id = $1 AND is_addon = true
       AND status NOT IN ('cancelled', 'rejected', 'checked_out') FOR UPDATE`,
    [roomBookingId],
  );
  let unpaidCost = 0;
  for (const row of addons.rows) {
    await restoreBookingPromotions(client, { previousStatus: String(row.status), boatBookingId: Number(row.boat_booking_id) });
    await restoreBoatTicketRedemptions(client, Number(row.boat_booking_id));
    await client.query(
      `UPDATE boat_bookings SET status = 'cancelled', updated_at = NOW() WHERE boat_booking_id = $1`,
      [row.boat_booking_id],
    );
    await client.query(
      `UPDATE booking_boat SET status = 'cancelled', updated_at = NOW() WHERE boat_booking_id = $1`,
      [row.boat_booking_id],
    );
    unpaidCost += Number(row.total_price) || 0;
  }
  if (previousRoomStatus === 'pending' && unpaidCost > 0) {
    await client.query(
      `UPDATE room_bookings SET total_price = GREATEST(total_price - $1, 0), updated_at = NOW()
       WHERE room_booking_id = $2`,
      [unpaidCost, roomBookingId],
    );
  }
}

export async function approveBoatAddonsForRoomBooking(client: QueryClient, roomBookingId: number): Promise<void> {
  const addons = await client.query(
    `SELECT boat_booking_id FROM boat_bookings
     WHERE room_booking_id = $1 AND is_addon = true AND status IN ('pending', 'paid') FOR UPDATE`,
    [roomBookingId],
  );
  for (const row of addons.rows) {
    await client.query(`UPDATE boat_bookings SET status = 'approved', updated_at = NOW() WHERE boat_booking_id = $1`, [row.boat_booking_id]);
    await client.query(`UPDATE booking_boat SET status = 'approved', updated_at = NOW() WHERE boat_booking_id = $1`, [row.boat_booking_id]);
  }
}
