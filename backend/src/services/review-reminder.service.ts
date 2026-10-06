import pool from '../config/database';
import { sendReviewReminderEmail } from './mail.service';

interface ReminderRow {
  room_booking_id: number;
  check_in: string | Date;
  check_out: string | Date;
  email: string;
  first_name: string | null;
  last_name: string | null;
  room_name: string | null;
  type_name: string | null;
}

// ส่ง email แจ้งเตือนให้รีวิวหลัง check-out
// - เลือกบิลที่ approved/checked_out, ทุกห้องที่ไม่ได้ยกเลิก checked_out แล้ว, และยังไม่เคยส่งเตือน
// - ข้ามบิลก็ต่อเมื่อ "ทุกประเภทห้อง" ในบิลมีรีวิวแล้ว (ถ้ายังมีประเภทที่ยังไม่รีวิว ยังส่งเตือน)
// - claim flag review_reminder_sent ก่อนส่ง เพื่อกันส่งซ้ำ และคืน flag เป็น false ถ้าส่งไม่สำเร็จ
export const sendPendingReviewReminders = async (): Promise<void> => {
  try {
    // หา booking ที่ check_out ผ่านมาแล้ว (เมื่อวานหรือวันนี้) และยังต้องเตือนรีวิว
    const result = await pool.query(
      `SELECT rb.room_booking_id, rb.check_in, rb.check_out,
              m.email, m.first_name, m.last_name,
              (
                SELECT string_agg(rt.room_name, ', ' ORDER BY br.booking_room_id)
                FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                JOIN room_types rt ON rt.id = r.room_type_id
                WHERE br.room_booking_id = rb.room_booking_id
                  AND br.status NOT IN ('cancelled', 'rejected')
              ) AS room_name,
              (
                SELECT rt.type_name
                FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                JOIN room_types rt ON rt.id = r.room_type_id
                WHERE br.room_booking_id = rb.room_booking_id
                  AND br.status NOT IN ('cancelled', 'rejected')
                ORDER BY br.booking_room_id LIMIT 1
              ) AS type_name
       FROM room_bookings rb
       JOIN members m ON rb.member_id = m.member_id
       WHERE rb.status IN ('approved', 'checked_out')
         AND rb.check_out::date <= CURRENT_DATE
         AND rb.check_out::date >= CURRENT_DATE - INTERVAL '1 day'
         AND rb.review_reminder_sent IS NOT TRUE
         AND EXISTS (
           SELECT 1 FROM booking_room br
           WHERE br.room_booking_id = rb.room_booking_id
             AND br.status NOT IN ('cancelled', 'rejected')
         )
         AND NOT EXISTS (
           SELECT 1 FROM booking_room br
           WHERE br.room_booking_id = rb.room_booking_id
             AND br.status NOT IN ('cancelled', 'rejected', 'checked_out')
         )
         AND EXISTS (
           SELECT 1 FROM booking_room br
           JOIN rooms r ON r.room_id = br.room_id
           WHERE br.room_booking_id = rb.room_booking_id
             AND br.status NOT IN ('cancelled', 'rejected')
             AND NOT EXISTS (
               SELECT 1 FROM reviews rv
               WHERE rv.room_booking_id = rb.room_booking_id AND rv.room_type_id = r.room_type_id
             )
         )`
    );

    const rows = result.rows as ReminderRow[];
    if (rows.length === 0) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    for (const row of rows) {
      try {
        // claim: เฉพาะรอบที่ UPDATE สำเร็จเท่านั้นที่ได้ส่ง
        const claim = await pool.query(
          `UPDATE room_bookings SET review_reminder_sent = true
           WHERE room_booking_id = $1 AND review_reminder_sent IS NOT TRUE
           RETURNING room_booking_id`,
          [row.room_booking_id]
        );
        if ((claim.rowCount ?? 0) === 0) continue;

        try {
          await sendReviewReminderEmail({
            to: row.email,
            recipientName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            roomName: `${row.room_name} (${row.type_name})`,
            checkIn: new Date(row.check_in).toLocaleDateString('th-TH', { dateStyle: 'medium' }),
            checkOut: new Date(row.check_out).toLocaleDateString('th-TH', { dateStyle: 'medium' }),
            reviewUrl: `${frontendUrl}/reviews`,
          });
          console.log(`[Review Reminder] Sent to ${row.email} for booking #${row.room_booking_id}`);
        } catch (mailErr) {
          console.error(`[Review Reminder] Failed to send to ${row.email}:`, mailErr);
          // ส่งไม่สำเร็จ: คืนสิทธิ์ให้รอบถัดไปลองใหม่
          await pool.query(
            `UPDATE room_bookings SET review_reminder_sent = false WHERE room_booking_id = $1`,
            [row.room_booking_id]
          ).catch((resetErr: unknown) => {
            console.error(`[Review Reminder] Failed to reset flag for booking #${row.room_booking_id}:`, resetErr);
          });
        }
      } catch (rowErr) {
        console.error(`[Review Reminder] Failed for booking #${row.room_booking_id}:`, rowErr);
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
