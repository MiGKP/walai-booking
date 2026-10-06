import cron from 'node-cron';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import { restoreBookingPromotions } from './promotion-ledger';
import { cancelBoatAddonsForRoomBooking, restoreBoatTicketRedemptions } from './boat-booking-lifecycle';

// ยกเลิก booking ที่หมดเวลาชำระเงินแล้ว (status = pending และ created_at + payment_due_days < NOW)
// ทำทั้งรอบใน transaction เดียว และคืนโควตาโปรโมชั่น/บัตรพายเรือ เหมือนการยกเลิกด้วยมือ (cancelRoomBooking)
export const cancelExpiredBookings = async (): Promise<void> => {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    // ดึง payment_due_days จาก resort_info แถว id=3 (สถานที่หลัก) ซึ่งเป็นค่าที่หน้าตั้งค่าใช้
    const resortRes = await client.query(`SELECT payment_due_days FROM resort_info WHERE id = 3 LIMIT 1`);
    const rawDays = resortRes.rows[0]?.payment_due_days;
    const dueDays = rawDays !== null && rawDays !== undefined ? Number(rawDays) : 3;
    console.log(`[Auto-Cancel] Running — payment_due_days = ${dueDays} (raw: ${rawDays})`);

    await client.query('BEGIN');

    // Cancel room_bookings ที่หมดเวลา
    const roomResult = await client.query(
      `UPDATE room_bookings
       SET status = 'cancelled'
       WHERE status = 'pending'
         AND created_at + make_interval(days => $1) < NOW()
       RETURNING room_booking_id`,
      [dueDays]
    );
    const roomIds = (roomResult.rows as Array<{ room_booking_id: number }>).map((r) => Number(r.room_booking_id));
    for (const roomBookingId of roomIds) {
      await client.query(
        `UPDATE booking_room SET status = 'cancelled', updated_at = NOW()
         WHERE room_booking_id = $1 AND status <> 'checked_out'`,
        [roomBookingId]
      );
      // คืนโควตาโปรโมชั่นและ wallet (สถานะก่อนยกเลิกคือ pending เสมอ)
      await restoreBookingPromotions(client, { previousStatus: 'pending', roomBookingId });
      await cancelBoatAddonsForRoomBooking(client, roomBookingId, 'pending');
      // เพิกถอนบัตรพายเรือฟรีที่แจกไว้จากการจองนี้ (เฉพาะที่ยังไม่ถูกใช้เลย) เหมือน cancelRoomBooking
      await client.query(
        `DELETE FROM member_boat_tickets WHERE room_booking_id = $1 AND used_tickets = 0`,
        [roomBookingId]
      );
    }

    // Cancel boat_bookings ที่หมดเวลา
    const boatResult = await client.query(
      `UPDATE boat_bookings
       SET status = 'cancelled'
       WHERE status = 'pending'
         AND is_addon = false
         AND created_at + make_interval(days => $1) < NOW()
       RETURNING boat_booking_id`,
      [dueDays]
    );
    const boatIds = (boatResult.rows as Array<{ boat_booking_id: number }>).map((r) => Number(r.boat_booking_id));
    for (const boatBookingId of boatIds) {
      await client.query(
        `UPDATE booking_boat SET status = 'cancelled', updated_at = NOW()
         WHERE boat_booking_id = $1`,
        [boatBookingId]
      );
      await restoreBookingPromotions(client, { previousStatus: 'pending', boatBookingId });
      await restoreBoatTicketRedemptions(client, boatBookingId);
    }

    await client.query('COMMIT');

    if (roomIds.length + boatIds.length > 0) {
      console.log(`[Auto-Cancel] Cancelled ${roomIds.length} room booking(s) and ${boatIds.length} boat booking(s) (due days: ${dueDays})`);
    }
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    console.error('[Auto-Cancel] Job error:', error);
  } finally {
    client?.release();
  }
};

// เริ่ม cron job ตรวจสอบทุก 15 นาที (*/15 * * * *)
export const startAutoCancelJob = (): void => {
  console.log('[Auto-Cancel] Job started — runs every 15 minutes');
  cancelExpiredBookings(); // run once on startup
  cron.schedule('*/15 * * * *', cancelExpiredBookings);
};
