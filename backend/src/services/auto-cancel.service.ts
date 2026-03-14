import cron from 'node-cron';
import pool from '../config/database';

// ยกเลิก booking ที่หมดเวลาชำระเงินแล้ว (status = pending และ created_at + payment_due_days < NOW)
export const cancelExpiredBookings = async (): Promise<void> => {
  try {
    // ดึง payment_due_days จาก resort_info
    const resortRes = await pool.query(`SELECT payment_due_days FROM resort_info LIMIT 1`);
    const rawDays = resortRes.rows[0]?.payment_due_days;
    const dueDays = rawDays !== null && rawDays !== undefined ? Number(rawDays) : 3;
    console.log(`[Auto-Cancel] Running — payment_due_days = ${dueDays} (raw: ${rawDays})`);

    // Cancel room_bookings ที่หมดเวลา
    const roomResult = await pool.query(
      `UPDATE room_bookings
       SET status = 'cancelled'
       WHERE status = 'pending'
         AND created_at + make_interval(days => $1) < NOW()
       RETURNING room_booking_id, created_at`,
      [dueDays]
    );

    // Cancel boat_bookings ที่หมดเวลา
    const boatResult = await pool.query(
      `UPDATE boat_bookings
       SET status = 'cancelled'
       WHERE status = 'pending'
         AND created_at + make_interval(days => $1) < NOW()
       RETURNING boat_booking_id`,
      [dueDays]
    );

    const roomCancelled = roomResult.rowCount ?? 0;
    const boatCancelled = boatResult.rowCount ?? 0;
    if (roomCancelled + boatCancelled > 0) {
      console.log(`[Auto-Cancel] Cancelled ${roomCancelled} room booking(s) and ${boatCancelled} boat booking(s) (due days: ${dueDays})`);
    }
  } catch (error) {
    console.error('[Auto-Cancel] Job error:', error);
  }
};

// เริ่ม cron job ตรวจสอบทุก 15 นาที (*/15 * * * *)
export const startAutoCancelJob = (): void => {
  console.log('[Auto-Cancel] Job started — runs every 15 minutes');
  cancelExpiredBookings(); // run once on startup
  cron.schedule('*/15 * * * *', cancelExpiredBookings);
};
