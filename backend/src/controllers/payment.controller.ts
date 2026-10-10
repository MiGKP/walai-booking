import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { safeRollback } from '../utils/safe-rollback';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';
import pool from '../config/database';
import { AuthPayload } from '../types';
import { sendPaymentSlipNotificationEmail } from '../services/mail.service';
import { mapDbError } from '../utils/db-errors';
import { parsePositiveInt } from '../utils/ids';
import { approveBoatAddonsForRoomBooking } from '../services/boat-booking-lifecycle';
import {
  CloudinaryUploadResult,
  deleteCloudinaryImage,
  uploadImage,
} from '../services/cloudinary.service';

interface PaymentBookingRow {
  total_price: number | string;
  payment_status: string;
  payment_slip: string | null;
  status: string;
  reject_reason?: string | null;
  has_boat_tickets?: boolean;
  is_addon?: boolean;
}

// สร้างข้อมูลสำหรับหน้าชำระเงินของการจองห้องหรือเรือ โดยดึงยอดจริงจากฐานข้อมูลและสร้าง PromptPay QR Code แบบ Data URL
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { booking_type, booking_id } = req.body;

    // ดึงข้อมูลบัญชีธนาคารจาก resort_info (admin แก้ไขได้ผ่าน /admin/site-info)
    const resortRes = await pool.query(`SELECT bank_account_no, bank_account_name, promptpay_id FROM resort_info ORDER BY id ASC LIMIT 1`);
    const resort = resortRes.rows[0] || {};
    const bankInfo = {
      promptpay: resort.promptpay_id || process.env.PROMPTPAY_ID || '0000000000',
      account_number: resort.bank_account_no || process.env.BANK_ACCOUNT_NUMBER || '000-0-00000-0',
      account_name: resort.bank_account_name || process.env.BANK_ACCOUNT_NAME || 'ชื่อบัญชี',
    };

    let booking: PaymentBookingRow;
    if (booking_type === 'room') {
      const result = await pool.query(
        `SELECT total_price, payment_status, payment_slip, status, reject_reason,
                EXISTS (SELECT 1 FROM member_boat_tickets WHERE room_booking_id = $1 AND booking_room_id IS NOT NULL) AS has_boat_tickets
         FROM room_bookings WHERE room_booking_id = $1 AND (($2 = 'customer' AND member_id = $3) OR $2 != 'customer')`,
        [booking_id, user.role, user.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Room booking not found' });
        return;
      }
      booking = result.rows[0];
    } else if (booking_type === 'kayak') {
      const result = await pool.query(
        `SELECT total_price, payment_status, payment_slip, status, is_addon, reject_reason 
         FROM boat_bookings WHERE boat_booking_id = $1 AND (($2 = 'customer' AND member_id = $3) OR $2 != 'customer')`,
        [booking_id, user.role, user.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Boat booking not found' });
        return;
      }
      booking = result.rows[0];
    } else {
      res.status(400).json({ success: false, message: 'Invalid booking type' });
      return;
    }

    if (booking.is_addon) {
      res.status(400).json({ success: false, message: 'กรุณาชำระค่าเรือเสริมผ่านบิลห้องพัก' });
      return;
    }
    const qrData = generatePayload(bankInfo.promptpay, { amount: Number(booking.total_price) });
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'M', width: 300 });

    res.status(201).json({
      success: true,
      message: 'Payment details generated',
      data: {
        id: `${booking_type}_${booking_id}`,
        booking_type,
        booking_id,
        amount: booking.total_price,
        status: booking.payment_status,
        // สถานะจริงของการจอง (pending/paid/approved/rejected/cancelled/checked_out) — ต้องใช้ตัวนี้แยกกรณีถูกปฏิเสธ/ยกเลิก
        // เพราะ payment_status จะค้างเป็น 'paid' ตลอดหลังอัปโหลดสลิป ไม่ว่าเจ้าหน้าที่จะอนุมัติหรือปฏิเสธในภายหลัง
        booking_status: booking.status,
        reject_reason: booking.reject_reason ?? null,
        slip_image: booking.payment_slip,
        has_boat_tickets: booking.has_boat_tickets ?? false,
        qr_code_url: qrCodeDataUrl,
        bank_info: bankInfo,
      },
    });
  } catch (error) {
    console.error('Create payment error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// รับไฟล์สลิปจาก member แล้วผูกสลิปเข้ากับรายการจองที่เป็นเจ้าของอยู่ พร้อมอัปเดตสถานะเป็นรอตรวจสอบการชำระเงิน
// และส่งอีเมลแจ้ง admin/staff ให้มาตรวจสอบสลิป
export const uploadPaymentSlip = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;

    if (user.role !== 'customer') {
      res.status(403).json({
        success: false,
        message: 'ผู้ดูแลระบบและเจ้าหน้าที่สามารถดูหน้าชำระเงินและหน้าส่งสลิปเพื่อตรวจสอบระบบได้เท่านั้น ไม่สามารถยืนยันการชำระเงินได้',
      });
      return;
    }

    const { id } = req.params; // format: room_123 or kayak_456
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }
    const [bType, bId] = id.split('_');

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพสลิปก่อนอัปโหลด' });
      return;
    }

    if (bType !== 'room' && bType !== 'kayak') {
      res.status(400).json({ success: false, message: 'Invalid payment ID format' });
      return;
    }
    if (parsePositiveInt(bId) === null) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }

    const existing = bType === 'room'
      ? await pool.query(
        `SELECT rb.status, rb.total_price, m.first_name, m.last_name,
                COALESCE(rb.guest_name, CONCAT_WS(' ', m.first_name, m.last_name)) AS customer_name
         FROM room_bookings rb
         JOIN members m ON rb.member_id = m.member_id
         WHERE rb.room_booking_id = $1 AND rb.member_id = $2`,
        [bId, user.id]
      )
      : await pool.query(
        `SELECT bb.status, bb.total_price, bb.is_addon, m.first_name, m.last_name
         FROM boat_bookings bb
         JOIN members m ON bb.member_id = m.member_id
         WHERE bb.boat_booking_id = $1 AND bb.member_id = $2`,
        [bId, user.id]
      );

    if (existing.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
      return;
    }

    const booking = existing.rows[0];
    if (booking.is_addon) {
      res.status(400).json({ success: false, message: 'กรุณาชำระค่าเรือเสริมผ่านบิลห้องพัก' });
      return;
    }
    if (booking.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot upload slip for a booking with status: ${booking.status}`,
      });
      return;
    }

    let uploadedSlip: CloudinaryUploadResult;
    try {
      uploadedSlip = await uploadImage(file.buffer, {
        folder: 'walai-booking/slips',
        publicId: `${bType}-${bId}-${randomUUID()}`,
      });
    } catch (error) {
      console.error('Payment slip Cloudinary upload error:', error);
      res.status(503).json({
        success: false,
        message: 'ไม่สามารถอัปโหลดสลิปได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      });
      return;
    }

    const removeUploadedSlip = async (): Promise<void> => {
      await deleteCloudinaryImage(uploadedSlip.url).catch((cleanupError: unknown) => {
        console.error('Payment slip cleanup error:', cleanupError);
      });
    };

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      if (bType === 'room') {
        const slipUpdate = await client.query(
          `UPDATE room_bookings SET payment_slip = $1, payment_status = 'paid', status = 'paid', payment_submitted_at = NOW()
           WHERE room_booking_id = $2 AND member_id = $3 AND status = 'pending'`,
          [uploadedSlip.url, bId, user.id]
        );
        if (slipUpdate.rowCount === 0) {
          await safeRollback(client);
          await removeUploadedSlip();
          res.status(409).json({ success: false, message: 'สถานะการจองเปลี่ยนไปแล้ว กรุณาตรวจสอบอีกครั้ง' });
          return;
        }
        await client.query(
          `UPDATE booking_room SET status = 'paid', updated_at = NOW()
           WHERE room_booking_id = $1 AND status <> 'checked_out'`,
          [bId]
        );
      } else {
        const slipUpdate = await client.query(
          `UPDATE boat_bookings SET payment_slip = $1, payment_status = 'paid', status = 'paid' WHERE boat_booking_id = $2 AND member_id = $3 AND status = 'pending' AND is_addon = false`,
          [uploadedSlip.url, bId, user.id]
        );
        if (slipUpdate.rowCount === 0) {
          await safeRollback(client);
          await removeUploadedSlip();
          res.status(409).json({ success: false, message: 'สถานะการจองเปลี่ยนไปแล้ว กรุณาตรวจสอบอีกครั้ง' });
          return;
        }
        // เฉพาะรายการที่ยัง pending เท่านั้น เพื่อไม่ให้รายการที่ถูกยกเลิกกลับมาใช้งานอีก
        await client.query(
          `UPDATE booking_boat SET status = 'paid', updated_at = NOW()
           WHERE boat_booking_id = $1 AND status = 'pending'`,
          [bId]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      if (client) await safeRollback(client);
      await removeUploadedSlip();
      throw error;
    } finally {
      client?.release();
    }

    const totalPrice = Number(booking.total_price);
    const memberName = booking.customer_name || `${booking.first_name || ''} ${booking.last_name || ''}`.trim();

    // ส่งอีเมลแจ้งเตือน admin / staff ให้มาตรวจสอบสลิป (fire-and-forget)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const dashboardUrl = bType === 'room'
      ? `${frontendUrl}/admin/rooms/dashboard`
      : `${frontendUrl}/admin/boats/dashboard`;

    // ดึง email ของ admin และ staff ที่เกี่ยวข้องเพื่อส่งแจ้งเตือน
    const staffRole = bType === 'room' ? ['admin', 'room_staff'] : ['admin', 'boat_staff'];
    pool.query(
      `SELECT email FROM staff WHERE role = ANY($1) AND status = true`,
      [staffRole]
    ).then(staffRes => {
      const emails = staffRes.rows
        .map((row: { email?: string }) => row.email)
        .filter((email: string | undefined): email is string => Boolean(email));
      if (emails.length > 0) {
        sendPaymentSlipNotificationEmail({
          to: emails.join(','),
          customerName: memberName || user.email,
          bookingType: bType as 'room' | 'kayak',
          bookingId: Number(bId),
          amount: totalPrice,
          adminDashboardUrl: dashboardUrl,
        }).catch(console.error);
      }
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Payment slip uploaded, awaiting confirmation',
      data: { slip_image: uploadedSlip.url },
    });
  } catch (error) {
    console.error('Upload slip error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ให้เจ้าหน้าที่หรือผู้ดูแลระบบยืนยันการชำระเงิน แล้วเปลี่ยนสถานะ booking จาก paid ไปเป็น approved
export const confirmPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authUser = req.user as AuthPayload;
    
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }
    const [bType, bId] = id.split('_');

    const confirmRole = authUser.role;
    if ((bType === 'room' && confirmRole === 'boat_staff') || (bType === 'kayak' && confirmRole === 'room_staff')) {
      res.status(403).json({ success: false, message: 'Forbidden: staff cannot confirm this booking type' });
      return;
    }
    if (bType !== 'room' && bType !== 'kayak') {
      res.status(400).json({ success: false, message: 'Invalid payment ID format' });
      return;
    }
    if (parsePositiveInt(bId) === null) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const bookingCheck = await client.query(
        bType === 'room'
          ? `SELECT payment_slip, status, total_price FROM room_bookings WHERE room_booking_id = $1 FOR UPDATE`
          : `SELECT payment_slip, status FROM boat_bookings WHERE boat_booking_id = $1 FOR UPDATE`,
        [bId]
      );
      if (bookingCheck.rows.length === 0) {
        await safeRollback(client);
        res.status(404).json({ success: false, message: 'Booking not found' });
        return;
      }
      const zeroChargeRoom = bType === 'room' && Number(bookingCheck.rows[0].total_price) === 0;
      if (bookingCheck.rows[0].status !== 'paid' && !(zeroChargeRoom && bookingCheck.rows[0].status === 'pending')) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: `Cannot approve booking with status: ${bookingCheck.rows[0].status}` });
        return;
      }
      if (!zeroChargeRoom && !String(bookingCheck.rows[0].payment_slip ?? '').trim()) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: 'กรุณาแนบสลิปชำระเงินก่อนอนุมัติการจอง' });
        return;
      }

      if (bType === 'room') {
        const headerUpdate = await client.query(
          `UPDATE room_bookings
           SET payment_status = 'paid', status = 'approved', payment_date = NOW(), approved_by_staff_id = $1
           WHERE room_booking_id = $2 AND (status = 'paid' OR (status = 'pending' AND total_price = 0))`,
          [authUser.id, bId]
        );
        if (headerUpdate.rowCount === 0) {
          await safeRollback(client);
          res.status(409).json({ success: false, message: 'สถานะการจองเปลี่ยนไปแล้ว กรุณาตรวจสอบอีกครั้ง' });
          return;
        }
        await client.query(
          `UPDATE booking_room SET status = 'approved', updated_at = NOW()
           WHERE room_booking_id = $1 AND status <> 'checked_out'`,
          [bId]
        );
        // อนุมัติบัตรเสริมเรือคายัคที่ผูกกับห้องพักนี้ไปพร้อมกัน
        await approveBoatAddonsForRoomBooking(client, Number(bId));
      } else {
        const headerUpdate = await client.query(
          `UPDATE boat_bookings
           SET payment_status = 'paid', status = 'approved', approved_by_staff_id = $1
           WHERE boat_booking_id = $2 AND status = 'paid'`,
          [authUser.id, bId]
        );
        if (headerUpdate.rowCount === 0) {
          await safeRollback(client);
          res.status(409).json({ success: false, message: 'สถานะการจองเปลี่ยนไปแล้ว กรุณาตรวจสอบอีกครั้ง' });
          return;
        }
        await client.query(
          `UPDATE booking_boat SET status = 'approved', updated_at = NOW()
           WHERE boat_booking_id = $1`,
          [bId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError: unknown) => {
        console.error('Confirm payment rollback error:', rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Payment confirmed and booking approved' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงข้อมูลการชำระเงินรายรายการตาม id เพื่อใช้ดูสถานะ, สลิป และรายละเอียดประกอบการตรวจสอบหรือแสดงผล
export const getPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }
    const [bType, bId] = id.split('_');
    if ((bType !== 'room' && bType !== 'kayak') || parsePositiveInt(bId) === null) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }

    let payment;
    if (bType === 'room') {
      const result = await pool.query(
        `SELECT room_booking_id as booking_id, total_price as amount, payment_status as status,
                status as booking_status, reject_reason, payment_slip as slip_image,
                (SELECT COUNT(*) > 0 FROM member_boat_tickets WHERE room_booking_id = $1 AND booking_room_id IS NOT NULL) as has_boat_tickets
         FROM room_bookings WHERE room_booking_id = $1 AND (($3 = 'customer' AND member_id = $2) OR $3 IN ('admin', 'room_staff'))`,
        [bId, user.id, user.role]
      );
      payment = result.rows[0];
    } else {
      const result = await pool.query(
        `SELECT boat_booking_id as booking_id, total_price as amount, payment_status as status,
                status as booking_status, reject_reason, payment_slip as slip_image
         FROM boat_bookings WHERE boat_booking_id = $1 AND (($3 = 'customer' AND member_id = $2) OR $3 IN ('admin', 'boat_staff'))`,
        [bId, user.id, user.role]
      );
      payment = result.rows[0];
    }

    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    const resortRes2 = await pool.query(`SELECT bank_account_no, bank_account_name, promptpay_id FROM resort_info ORDER BY id ASC LIMIT 1`);
    const resort2 = resortRes2.rows[0] || {};
    const bankInfo2 = {
      promptpay: resort2.promptpay_id || process.env.PROMPTPAY_ID || '0000000000',
      account_number: resort2.bank_account_no || process.env.BANK_ACCOUNT_NUMBER || '000-0-00000-0',
      account_name: resort2.bank_account_name || process.env.BANK_ACCOUNT_NAME || 'ชื่อบัญชี',
    };

    res.json({
      success: true,
      data: { ...payment, id, booking_type: bType, bank_info: bankInfo2 },
    });
  } catch (error) {
    console.error('Get payment error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงประวัติการชำระเงินทั้งหมดของ member คนที่ login อยู่ โดยรวมทั้งการจองห้องและการจองเรือไว้ในรายการเดียว
export const getUserPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(`
      SELECT 'room_' || room_booking_id as id, 'room' as booking_type, total_price as amount, payment_status as status, created_at
      FROM room_bookings WHERE member_id = $1 AND payment_slip IS NOT NULL
      UNION ALL
      SELECT 'kayak_' || boat_booking_id as id, 'kayak' as booking_type, total_price as amount, payment_status as status, created_at
      FROM boat_bookings WHERE member_id = $1 AND payment_slip IS NOT NULL
      ORDER BY created_at DESC
    `, [user.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get user payments error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการชำระเงินทั้งหมดในระบบสำหรับฝั่งผู้ดูแลหรือเจ้าหน้าที่ เพื่อใช้ตรวจสอบสลิปและสถานะการชำระเงินรวม
export const getAllPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT 
         'room_' || rb.room_booking_id as id, 
         'room' as booking_type,
         COALESCE(rb.guest_name, CONCAT_WS(' ', m.first_name, m.last_name)) as user_name,
         COALESCE(rb.guest_email, m.email) as user_email,
         rb.total_price as amount,
         rb.payment_status as status,
         rb.payment_slip as slip_image,
         rb.created_at
       FROM room_bookings rb 
       JOIN members m ON rb.member_id = m.member_id
       WHERE rb.payment_slip IS NOT NULL
       UNION ALL
       SELECT 
         'kayak_' || bb.boat_booking_id as id, 
         'kayak' as booking_type,
         CONCAT_WS(' ', m.first_name, m.last_name) as user_name,
         m.email as user_email,
         bb.total_price as amount,
         bb.payment_status as status,
         bb.payment_slip as slip_image,
         bb.created_at
       FROM boat_bookings bb 
       JOIN members m ON bb.member_id = m.member_id
       WHERE bb.payment_slip IS NOT NULL
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all payments error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

