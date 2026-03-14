import pool from '../config/database';
import { sendReviewReminderEmail } from './mail.service';

// ส่ง email แจ้งเตือนให้รีวิวหลัง check-out โดย query booking ที่ check_out ผ่านมาแล้วและยังไม่ได้รีวิว
export const sendPendingReviewReminders = async (): Promise<void> => {
  try {
    // หา booking ที่ approved + check_out เมื่อวานหรือวันนี้ + ยังไม่มี review + ยังไม่เคยส่ง email
    const result = await pool.query(
      `SELECT rb.room_booking_id, rb.check_in, rb.check_out,
              m.email, m.first_name, m.last_name,
              rt.room_name, rt.type_name
       FROM room_bookings rb
       JOIN rooms r ON rb.room_id = r.room_id
       JOIN room_types rt ON r.room_type_id = rt.id
       JOIN members m ON rb.member_id = m.member_id
       WHERE rb.status = 'approved'
         AND rb.check_out::date <= CURRENT_DATE
         AND rb.check_out::date >= CURRENT_DATE - INTERVAL '1 day'
         AND rb.review_reminder_sent = false
         AND NOT EXISTS (
           SELECT 1 FROM reviews rv WHERE rv.room_booking_id = rb.room_booking_id
         )`
    );

    if (result.rows.length === 0) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    for (const row of result.rows) {
      try {
        await sendReviewReminderEmail({
          to: row.email,
          recipientName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          roomName: `${row.room_name} (${row.type_name})`,
          checkIn: new Date(row.check_in).toLocaleDateString('th-TH', { dateStyle: 'medium' }),
          checkOut: new Date(row.check_out).toLocaleDateString('th-TH', { dateStyle: 'medium' }),
          reviewUrl: `${frontendUrl}/reviews`,
        });

        await pool.query(
          `UPDATE room_bookings SET review_reminder_sent = true WHERE room_booking_id = $1`,
          [row.room_booking_id]
        );

        console.log(`[Review Reminder] Sent to ${row.email} for booking #${row.room_booking_id}`);
      } catch (mailErr) {
        console.error(`[Review Reminder] Failed to send to ${row.email}:`, mailErr);
      }
    }
  } catch (error) {
    console.error('[Review Reminder] Job error:', error);
  }
};

// เริ่ม interval ส่ง review reminder ทุก 1 ชั่วโมง
export const startReviewReminderJob = (): void => {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log('[Review Reminder] Job started — runs every 1 hour');
  sendPendingReviewReminders(); // run once on startup
  setInterval(sendPendingReviewReminders, INTERVAL_MS);
};
