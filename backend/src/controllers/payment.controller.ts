import { Request, Response } from 'express';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';
import pool from '../config/database';
import { AuthPayload } from '../types';

// สร้างข้อมูลสำหรับหน้าชำระเงินของการจองห้องหรือเรือ โดยดึงยอดจริงจากฐานข้อมูลและสร้าง PromptPay QR Code แบบ Data URL
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { booking_type, booking_id } = req.body;

    // ดึงข้อมูลบัญชีธนาคารจาก resort_info (admin แก้ไขได้ผ่าน /admin/site-info)
    const resortRes = await pool.query(`SELECT bank_account_no, bank_account_name, promptpay_id FROM resort_info LIMIT 1`);
    const resort = resortRes.rows[0] || {};
    const bankInfo = {
      promptpay: resort.promptpay_id || process.env.PROMPTPAY_ID || '0000000000',
      account_number: resort.bank_account_no || process.env.BANK_ACCOUNT_NUMBER || '000-0-00000-0',
      account_name: resort.bank_account_name || process.env.BANK_ACCOUNT_NAME || 'ชื่อบัญชี',
    };

    let booking: any;
    if (booking_type === 'room') {
      const result = await pool.query(
        'SELECT total_price, payment_status, payment_slip FROM room_bookings WHERE room_booking_id = $1 AND member_id = $2',
        [booking_id, user.id]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Room booking not found' });
        return;
      }
      booking = result.rows[0];
    } else if (booking_type === 'kayak') {
      const result = await pool.query(
        'SELECT total_price, payment_status, payment_slip FROM boat_bookings WHERE boat_booking_id = $1 AND member_id = $2',
        [booking_id, user.id]
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
        slip_image: booking.payment_slip,
        qr_code_url: qrCodeDataUrl,
        bank_info: bankInfo,
      },
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// รับไฟล์สลิปจาก member แล้วผูกสลิปเข้ากับรายการจองที่เป็นเจ้าของอยู่ พร้อมอัปเดตสถานะเป็นรอตรวจสอบการชำระเงิน
export const uploadPaymentSlip = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params; // format: room_123 or kayak_456
    const [bType, bId] = id.split('_');

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No slip image provided' });
      return;
    }

    const slipPath = `/uploads/${file.filename}`;
    
    if (bType === 'room') {
      const existing = await pool.query(
        `SELECT status FROM room_bookings WHERE room_booking_id = $1 AND member_id = $2`,
        [bId, user.id]
      );
      if (existing.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
        return;
      }
      if (!['pending', 'approved'].includes(existing.rows[0].status)) {
        res.status(400).json({ success: false, message: 'Cannot upload slip for a booking with status: ' + existing.rows[0].status });
        return;
      }
      await pool.query(
        `UPDATE room_bookings SET payment_slip = $1, payment_status = 'paid', status = 'paid' WHERE room_booking_id = $2 AND member_id = $3`,
        [slipPath, bId, user.id]
      );
    } else if (bType === 'kayak') {
      const existing = await pool.query(
        `SELECT status FROM boat_bookings WHERE boat_booking_id = $1 AND member_id = $2`,
        [bId, user.id]
      );
      if (existing.rowCount === 0) {
        res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
        return;
      }
      if (!['pending', 'approved'].includes(existing.rows[0].status)) {
        res.status(400).json({ success: false, message: 'Cannot upload slip for a booking with status: ' + existing.rows[0].status });
        return;
      }
      await pool.query(
        `UPDATE boat_bookings SET payment_slip = $1, payment_status = 'paid', status = 'paid' WHERE boat_booking_id = $2 AND member_id = $3`,
        [slipPath, bId, user.id]
      );
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment ID format' });
      return;
    }

    res.json({ success: true, message: 'Payment slip uploaded, awaiting confirmation', data: { slip_image: slipPath } });
  } catch (error) {
    console.error('Upload slip error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ให้เจ้าหน้าที่หรือผู้ดูแลระบบยืนยันการชำระเงิน แล้วเปลี่ยนสถานะ booking จาก paid ไปเป็น approved
export const confirmPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authUser = req.user as AuthPayload;
    
    const [bType, bId] = id.split('_');

    if (bType === 'room') {
      const bookingCheck = await pool.query(
        `SELECT payment_slip FROM room_bookings WHERE room_booking_id = $1`,
        [bId]
      );
      if (bookingCheck.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Booking not found' });
        return;
      }
      if (!bookingCheck.rows[0].payment_slip) {
        res.status(400).json({ success: false, message: 'Cannot approve: no payment slip uploaded yet' });
        return;
      }
      await pool.query(
        `UPDATE room_bookings 
         SET payment_status = 'paid', status = 'approved', payment_date = NOW(), verify_by_staff_id = $1
         WHERE room_booking_id = $2`,
        [authUser.id, bId]
      );
    } else if (bType === 'kayak') {
      const bookingCheck = await pool.query(
        `SELECT payment_slip FROM boat_bookings WHERE boat_booking_id = $1`,
        [bId]
      );
      if (bookingCheck.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Booking not found' });
        return;
      }
      if (!bookingCheck.rows[0].payment_slip) {
        res.status(400).json({ success: false, message: 'Cannot approve: no payment slip uploaded yet' });
        return;
      }
      await pool.query(
        `UPDATE boat_bookings 
         SET payment_status = 'paid', status = 'approved'
         WHERE boat_booking_id = $1`,
        [bId]
      );
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment ID format' });
      return;
    }

    res.json({ success: true, message: 'Payment confirmed and booking approved' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงข้อมูลการชำระเงินรายรายการตาม id เพื่อใช้ดูสถานะ, สลิป และรายละเอียดประกอบการตรวจสอบหรือแสดงผล
export const getPaymentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const [bType, bId] = id.split('_');

    let payment;
    if (bType === 'room') {
      const result = await pool.query(
        `SELECT room_booking_id as booking_id, total_price as amount, payment_status as status, payment_slip as slip_image 
         FROM room_bookings WHERE room_booking_id = $1 AND (member_id = $2 OR $3 = 'admin')`,
        [bId, user.id, user.role]
      );
      payment = result.rows[0];
    } else {
      const result = await pool.query(
        `SELECT boat_booking_id as booking_id, total_price as amount, payment_status as status, payment_slip as slip_image 
         FROM boat_bookings WHERE boat_booking_id = $1 AND (member_id = $2 OR $3 = 'admin')`,
        [bId, user.id, user.role]
      );
      payment = result.rows[0];
    }

    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    const resortRes2 = await pool.query(`SELECT bank_account_no, bank_account_name, promptpay_id FROM resort_info LIMIT 1`);
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
         m.first_name || ' ' || m.last_name as user_name,
         m.email as user_email,
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
         m.first_name || ' ' || m.last_name as user_name,
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
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

