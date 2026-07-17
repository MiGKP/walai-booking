import nodemailer from 'nodemailer';

const requiredMailEnv = ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS'] as const;

const getMissingMailEnv = (): string[] => {
  return requiredMailEnv.filter((key) => !process.env[key]);
};

const getMailFrom = (): string => {
  return process.env.MAIL_FROM || `${process.env.APP_NAME || 'Walai Booking'} <${process.env.MAIL_USER}>`;
};

const createTransporter = (): nodemailer.Transporter => {
  const missingEnv = getMissingMailEnv();
  if (missingEnv.length > 0) {
    throw new Error(`Missing mail configuration: ${missingEnv.join(', ')}`);
  }

  const host = String(process.env.MAIL_HOST);
  const isGmail = host.includes('gmail.com');

  // Timeouts กัน SMTP ค้างบน Render (เดิม verify/send ไม่มี timeout ทำให้ API hang)
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000,
    });
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT),
    secure: String(process.env.MAIL_SECURE || 'false') === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
};

const sendMailSafely = async (options: nodemailer.SendMailOptions): Promise<void> => {
  const transporter = createTransporter();
  // ไม่เรียก verify() ก่อนส่ง — บน Render มัก hang นานและไม่จำเป็นสำหรับ App Password
  await transporter.sendMail(options);
};

export const sendReviewReminderEmail = async (params: {
  to: string;
  recipientName?: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  reviewUrl: string;
}): Promise<void> => {
  const appName = process.env.APP_NAME || 'Walai Booking';
  const recipientName = params.recipientName?.trim() || 'คุณลูกค้า';

  await sendMailSafely({
    from: getMailFrom(),
    to: params.to,
    subject: `ขอบคุณที่เข้าพักกับ ${appName} — รบกวนรีวิวสักนิดนะครับ`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-block; background: #ccfbf1; color: #0f766e; font-weight: 700; padding: 10px 14px; border-radius: 999px;">${appName}</div>
          </div>
          <h1 style="font-size: 22px; margin: 0 0 12px; color: #111827;">ขอบคุณที่เข้าพักกับเรา</h1>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 8px;">สวัสดี ${recipientName}</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
            ขอบคุณที่เลือกพัก <strong>${params.roomName}</strong> กับวลัย<br />
            ช่วง <strong>${params.checkIn}</strong> – <strong>${params.checkOut}</strong>
          </p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
            หวังว่าคุณจะได้รับประสบการณ์ที่ดี หากมีเวลา รบกวนรีวิวการเข้าพักของคุณสักนิดนะครับ — ความคิดเห็นของคุณมีค่ามากสำหรับเรา
          </p>
          <a href="${params.reviewUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 24px;">
            เขียนรีวิว
          </a>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">หากคุณไม่ได้เข้าพักกับเรา สามารถละเว้นอีเมลนี้ได้</p>
        </div>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (params: {
  to: string;
  recipientName?: string;
  otpCode: string;
}): Promise<void> => {
  const appName = process.env.APP_NAME || 'Walai Booking';
  const recipientName = params.recipientName?.trim() || 'คุณลูกค้า';
  const expiresInMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30');

  await sendMailSafely({
    from: getMailFrom(),
    to: params.to,
    subject: `รีเซ็ตรหัสผ่าน ${appName}`,
    text: `สวัสดี ${recipientName}\n\nเราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ\nรหัส OTP ของคุณคือ: ${params.otpCode}\n\nOTP นี้จะหมดอายุภายใน ${expiresInMinutes} นาที\nหากคุณไม่ได้เป็นผู้ร้องขอ คุณสามารถละเว้นอีเมลนี้ได้`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-block; background: #ccfbf1; color: #0f766e; font-weight: 700; padding: 10px 14px; border-radius: 999px;">${appName}</div>
          </div>
          <h1 style="font-size: 24px; margin: 0 0 16px; color: #111827;">รีเซ็ตรหัสผ่าน</h1>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 12px;">สวัสดี ${recipientName}</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 18px;">เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณานำรหัส OTP ด้านล่างไปกรอกในหน้าตั้งรหัสผ่านใหม่</p>
          <div style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 24px; border-radius: 14px; font-size: 28px; font-weight: 700; letter-spacing: 8px; margin-bottom: 24px;">${params.otpCode}</div>
          <div style="background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px; color: #4b5563; line-height: 1.7;">
            OTP นี้จะหมดอายุภายใน ${expiresInMinutes} นาที<br />
            หากคุณไม่ได้เป็นผู้ร้องขอ คุณสามารถละเว้นอีเมลนี้ได้อย่างปลอดภัย
          </div>
        </div>
      </div>
    `,
  });
};

export const sendPaymentSlipNotificationEmail = async (params: {
  to: string;
  customerName: string;
  bookingType: 'room' | 'kayak';
  bookingId: number;
  amount: number;
  adminDashboardUrl: string;
}) => {
  const missingEnv = getMissingMailEnv();
  if (missingEnv.length > 0) {
    console.warn('[mail] Skipping slip notification — missing env:', missingEnv.join(', '));
    return;
  }
  const transporter = createTransporter();
  const appName = process.env.APP_NAME || 'Walai Booking';
  const bookingTypeLabel = params.bookingType === 'room' ? 'ห้องพัก' : 'เรือคายัค';

  try {
    await transporter.sendMail({
      from: getMailFrom(),
      to: params.to,
      subject: `[${appName}] มีสลิปใหม่รอตรวจสอบ — ${params.customerName}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
            <div style="margin-bottom: 24px;">
              <div style="display: inline-block; background: #fef3c7; color: #d97706; font-weight: 700; padding: 10px 14px; border-radius: 999px;">🔔 แจ้งเตือนสลิปใหม่</div>
            </div>
            <h1 style="font-size: 22px; margin: 0 0 16px; color: #111827;">มีสลิปการชำระเงินรอตรวจสอบ</h1>
            <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              ลูกค้า <strong>${params.customerName}</strong> ได้อัปโหลดสลิปการชำระเงินสำหรับการจอง${bookingTypeLabel}
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
              <div>📋 <strong>ประเภท:</strong> ${bookingTypeLabel}</div>
              <div>🔢 <strong>รหัสการจอง:</strong> #${params.bookingId}</div>
              <div>💰 <strong>ยอดชำระ:</strong> ฿${Number(params.amount).toLocaleString()}</div>
            </div>
            <a href="${params.adminDashboardUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 16px;">
              ไปตรวจสอบสลิป →
            </a>
            <p style="font-size: 13px; color: #9ca3af; margin: 16px 0 0;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ ${appName}</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[mail] Failed to send slip notification email:', err);
  }
};

export const sendBookingConfirmationEmail = async (params: {
  to: string;
  customerName: string;
  bookingType: 'room' | 'kayak';
  bookingId: number;
  details: string;
  dateInfo: string;
  totalPrice: number;
}) => {
  const missingEnv = getMissingMailEnv();
  if (missingEnv.length > 0) {
    console.warn('[mail] Skipping booking confirmation email — missing env:', missingEnv.join(', '));
    return;
  }
  const transporter = createTransporter();
  const appName = process.env.APP_NAME || 'Walai Booking';
  const bookingTypeLabel = params.bookingType === 'room' ? 'ห้องพัก' : 'เรือคายัค';

  try {
    await transporter.sendMail({
      from: getMailFrom(),
      to: params.to,
      subject: `[${appName}] สรุปการจอง${bookingTypeLabel} — รหัส #${params.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
            <div style="margin-bottom: 24px;">
              <div style="display: inline-block; background: #ccfbf1; color: #0f766e; font-weight: 700; padding: 10px 14px; border-radius: 999px;">🌊 ${appName}</div>
            </div>
            <h1 style="font-size: 22px; margin: 0 0 16px; color: #111827;">ขอบคุณสำหรับการจอง${bookingTypeLabel}!</h1>
            <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              สวัสดีคุณ <strong>${params.customerName}</strong><br />
              ระบบได้รับคำขอจอง${bookingTypeLabel}ของคุณแล้ว รายละเอียดดังนี้:
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
              <div>📋 <strong>รหัสการจอง:</strong> #${params.bookingId}</div>
              <div>🏠 <strong>รายการ:</strong> ${params.details}</div>
              <div>📅 <strong>วันที่:</strong> ${params.dateInfo}</div>
              <div>💰 <strong>ราคารวม:</strong> ฿${Number(params.totalPrice).toLocaleString()}</div>
            </div>
            <p style="font-size: 14px; line-height: 1.7; margin: 0 0 20px; color: #4b5563;">
              กรุณาชำระเงินและแนบสลิปผ่านทางหน้าประวัติการจองในเว็บไซต์ เพื่อให้พนักงานดำเนินการยืนยันการเข้าพักครับ
            </p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/bookings" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 16px;">
              ดูประวัติการจอง & แนบสลิป →
            </a>
            <p style="font-size: 13px; color: #9ca3af; margin: 16px 0 0;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ ${appName}</p>
          </div>
        </div>
      `,
    });
    console.log(`[mail] Booking confirmation email sent to ${params.to} for booking #${params.bookingId}`);
  } catch (err) {
    console.error('[mail] Failed to send booking confirmation email:', err);
  }
};

export const sendBookingStatusEmail = async (params: {
  to: string;
  customerName: string;
  bookingType: 'room' | 'kayak';
  bookingId: number;
  status: 'approved' | 'rejected';
  details: string;
}) => {
  const missingEnv = getMissingMailEnv();
  if (missingEnv.length > 0) {
    console.warn('[mail] Skipping booking status email — missing env:', missingEnv.join(', '));
    return;
  }
  const transporter = createTransporter();
  const appName = process.env.APP_NAME || 'Walai Booking';
  const bookingTypeLabel = params.bookingType === 'room' ? 'ห้องพัก' : 'เรือคายัค';
  const isApproved = params.status === 'approved';

  const subject = isApproved
    ? `[${appName}] การจอง${bookingTypeLabel}ได้รับการยืนยันแล้ว 🎉 — รหัส #${params.bookingId}`
    : `[${appName}] แจ้งเตือนสถานะการจอง${bookingTypeLabel} — รหัส #${params.bookingId}`;

  const badgeColor = isApproved ? 'background: #dcfce7; color: #15803d;' : 'background: #fee2e2; color: #b91c1c;';
  const badgeText = isApproved ? '✅ ยืนยันการจองสำเร็จ' : '❌ การจองถูกปฏิเสธ';
  const titleText = isApproved ? 'การจองของคุณได้รับการยืนยันเรียบร้อยแล้ว!' : 'การจองของคุณไม่ผ่านการอนุมัติ';

  try {
    await transporter.sendMail({
      from: getMailFrom(),
      to: params.to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
            <div style="margin-bottom: 24px;">
              <div style="display: inline-block; ${badgeColor} font-weight: 700; padding: 10px 14px; border-radius: 999px;">${badgeText}</div>
            </div>
            <h1 style="font-size: 22px; margin: 0 0 16px; color: #111827;">${titleText}</h1>
            <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              สวัสดีคุณ <strong>${params.customerName}</strong><br />
              ${isApproved ? 'พนักงานได้ตรวจสอบการชำระเงินและยืนยันการจองเรียบร้อยแล้ว ยินดีต้อนรับสู่สวนวลัยครับ 🌊' : 'สลิปการชำระเงินหรือรายการจองของคุณไม่ผ่านการตรวจสอบ กรุณาติดต่อพนักงานหรือแนบสลิปใหม่อีกครั้ง'}
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
              <div>📋 <strong>รหัสการจอง:</strong> #${params.bookingId}</div>
              <div>🏠 <strong>รายการ:</strong> ${params.details}</div>
              <div>📌 <strong>สถานะปัจจุบัน:</strong> ${isApproved ? 'ยืนยันการจองแล้ว (Approved)' : 'ปฏิเสธ (Rejected)'}</div>
            </div>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/bookings" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 16px;">
              ดูรายละเอียดการจอง →
            </a>
            <p style="font-size: 13px; color: #9ca3af; margin: 16px 0 0;">อีเมลนี้ส่งโดยอัตโนมัติจากระบบ ${appName}</p>
          </div>
        </div>
      `,
    });
    console.log(`[mail] Booking status email sent to ${params.to} for booking #${params.bookingId} (status: ${params.status})`);
  } catch (err) {
    console.error('[mail] Failed to send booking status email:', err);
  }
};

