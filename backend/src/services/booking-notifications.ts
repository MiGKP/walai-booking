import pool from '../config/database';
import { sendBookingStatusEmail } from './mail.service';

// ดึงข้อมูลลูกค้าและส่งอีเมลแจ้งผลการอนุมัติหรือปฏิเสธการจองหลังบันทึกฐานข้อมูลสำเร็จ
export async function notifyBookingStatus(
  bookingType: 'room' | 'kayak',
  bookingId: number,
  status: 'approved' | 'rejected',
  rejectReason?: string | null,
): Promise<void> {
  try {
    const result = await pool.query(bookingType === 'room'
      ? `SELECT COALESCE(NULLIF(rb.guest_email, ''), m.email) AS email,
                COALESCE(NULLIF(rb.guest_name, ''), CONCAT_WS(' ', m.first_name, m.last_name)) AS customer_name,
                (SELECT string_agg(rt.room_name || ' (ห้อง ' || r.room_number || ')', ', ' ORDER BY br.booking_room_id)
                 FROM booking_room br JOIN rooms r ON r.room_id = br.room_id
                 JOIN room_types rt ON rt.id = r.room_type_id WHERE br.room_booking_id = rb.room_booking_id) AS details
         FROM room_bookings rb JOIN members m ON rb.member_id = m.member_id WHERE rb.room_booking_id = $1`
      : `SELECT m.email, CONCAT_WS(' ', m.first_name, m.last_name) AS customer_name, bb.start_time, bb.end_time,
                (SELECT string_agg(bt.type_name, ', ' ORDER BY bnb.booking_boat_id)
                 FROM booking_boat bnb JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
                 WHERE bnb.boat_booking_id = bb.boat_booking_id) AS details
         FROM boat_bookings bb JOIN members m ON bb.member_id = m.member_id WHERE bb.boat_booking_id = $1`,
    [bookingId]);
    const info = result.rows[0];
    if (!info?.email) return;
    await sendBookingStatusEmail({
      to: info.email,
      customerName: info.customer_name || info.email,
      bookingType,
      bookingId,
      status,
      details: bookingType === 'room' ? info.details || 'การจองห้องพัก'
        : `${info.details || 'การจองเรือ'}${info.start_time && info.end_time ? ` (รอบเวลา ${String(info.start_time).slice(0, 5)} - ${String(info.end_time).slice(0, 5)})` : ''}`,
      rejectReason,
    });
  } catch (error) {
    console.error('Booking status notification failed:', error);
  }
}
