import pool from '../config/database';
import { sendPromotionExpiryEmail } from './mail.service';

interface ExpiryRow {
  member_promotion_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  code: string;
  name: string;
  end_date: string;
  days_left: number;
  target_stage: number;
  raw_stage: number;
  raw_end: string | null;
}

// แจ้งเตือนโปรที่ลูกค้าเก็บไว้ (status = saved) ที่จะหมดอายุภายใน 3 วันตามเวลาไทย
// - รอบที่ 1: เหลือ 2–3 วัน / รอบที่ 2: เหลือ 0–1 วัน (ส่งได้รอบละครั้ง)
// - ถ้าแอดมินเปลี่ยนวันสิ้นสุด รอบจะเริ่มใหม่ (เทียบกับ expiry_reminder_end)
// - ข้ามลูกค้าที่ปิดการรับอีเมลโปรโมชั่น (members.promo_email_opt_out)
// - claim ก่อนส่ง และคืนค่าเดิมถ้าส่งไม่สำเร็จ เพื่อให้รอบถัดไปลองใหม่
export const sendPendingPromotionExpiryReminders = async (): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT mp.member_promotion_id, m.email, m.first_name, m.last_name,
              p.code, p.name,
              to_char(p.end_date, 'YYYY-MM-DD') AS end_date,
              (p.end_date - (NOW() AT TIME ZONE 'Asia/Bangkok')::date) AS days_left,
              CASE WHEN (p.end_date - (NOW() AT TIME ZONE 'Asia/Bangkok')::date) <= 1 THEN 2 ELSE 1 END AS target_stage,
              mp.expiry_reminder_stage AS raw_stage,
              to_char(mp.expiry_reminder_end, 'YYYY-MM-DD') AS raw_end
       FROM member_promotions mp
       JOIN promotions p ON p.id = mp.promotion_id
       JOIN members m ON m.member_id = mp.member_id
       WHERE mp.status = 'saved'
         AND m.promo_email_opt_out = false
         AND p.is_active = true
         AND p.end_date IS NOT NULL
         AND (p.end_date - (NOW() AT TIME ZONE 'Asia/Bangkok')::date) BETWEEN 0 AND 3
         AND (CASE WHEN mp.expiry_reminder_end = p.end_date THEN mp.expiry_reminder_stage ELSE 0 END)
             < (CASE WHEN (p.end_date - (NOW() AT TIME ZONE 'Asia/Bangkok')::date) <= 1 THEN 2 ELSE 1 END)`
    );

    const rows = result.rows as ExpiryRow[];
    if (rows.length === 0) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    for (const row of rows) {
      try {
        const claim = await pool.query(
          `UPDATE member_promotions
           SET expiry_reminder_stage = $2, expiry_reminder_end = $3::date
           WHERE member_promotion_id = $1
             AND status = 'saved'
             AND (CASE WHEN expiry_reminder_end = $3::date THEN expiry_reminder_stage ELSE 0 END) < $2
           RETURNING member_promotion_id`,
          [row.member_promotion_id, row.target_stage, row.end_date]
        );
        if ((claim.rowCount ?? 0) === 0) continue;

        try {
          await sendPromotionExpiryEmail({
            to: row.email,
            recipientName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            promoName: row.name,
            code: row.code,
            endDate: new Date(`${row.end_date}T00:00:00+07:00`).toLocaleDateString('th-TH', { dateStyle: 'medium' }),
            daysLeft: Number(row.days_left),
            promoUrl: `${frontendUrl}/dashboard?tab=coupons`,
          });
          console.log(`[Promo Expiry] Stage ${row.target_stage} sent to ${row.email} for wallet #${row.member_promotion_id}`);
        } catch (mailErr) {
          console.error(`[Promo Expiry] Failed to send to ${row.email}:`, mailErr);
          await pool.query(
            `UPDATE member_promotions SET expiry_reminder_stage = $2, expiry_reminder_end = $3::date WHERE member_promotion_id = $1`,
            [row.member_promotion_id, row.raw_stage, row.raw_end]
          ).catch((resetErr: unknown) => {
            console.error(`[Promo Expiry] Failed to reset wallet #${row.member_promotion_id}:`, resetErr);
          });
        }
      } catch (rowErr) {
        console.error(`[Promo Expiry] Failed for wallet #${row.member_promotion_id}:`, rowErr);
      }
    }
  } catch (error) {
    console.error('[Promo Expiry] Job error:', error);
  }
};

// เริ่ม interval ตรวจโปรใกล้หมดอายุทุก 1 ชั่วโมง
export const startPromotionExpiryReminderJob = (): void => {
  const INTERVAL_MS = 60 * 60 * 1000;
  console.log('[Promo Expiry] Job started — runs every 1 hour');
  sendPendingPromotionExpiryReminders();
  setInterval(sendPendingPromotionExpiryReminders, INTERVAL_MS);
};
