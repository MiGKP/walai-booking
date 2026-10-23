import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';

const requiredMailEnv = ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS'] as const;

// ตรวจสอบตัวแปรสภาพแวดล้อมที่จำเป็นสำหรับการส่งอีเมลผ่าน SMTP
const getMissingMailEnv = (): string[] => {
  return requiredMailEnv.filter((key) => !process.env[key]);
};

// ตัดเครื่องหมายคำพูดที่ครอบข้อความและตัดช่องว่างหน้า-หลัง
const stripQuotes = (value: string): string => value.replace(/^["']|["']$/g, '').trim();

// แปลงอักขระพิเศษเป็น HTML entities เพื่อป้องกัน HTML injection ในเนื้อหาอีเมล
const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ดึงชื่อและอีเมลผู้ส่งเริ่มต้นจากตัวแปรสภาพแวดล้อม
const getMailFrom = (): string => {
  const raw =
    process.env.MAIL_FROM ||
    `${process.env.APP_NAME || 'Walai Booking'} <${process.env.MAIL_USER}>`;
  return stripQuotes(raw);
};

// ดึงรหัสผ่านอีเมลและลบช่องว่างทั้งหมดออก
const getMailPass = (): string => {
  return stripQuotes(String(process.env.MAIL_PASS || '')).replace(/\s+/g, '');
};

// ดึงชื่อผู้ใช้อีเมลสำหรับเชื่อมต่อ SMTP
const getMailUser = (): string => stripQuotes(String(process.env.MAIL_USER || ''));

interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface BrevoSender {
  email: string;
  name: string;
}

// แยกชื่อและอีเมลผู้ส่งสำหรับใช้งานกับ Brevo API
const getBrevoSender = (): BrevoSender => {
  const mailFrom = getMailFrom();
  const namedAddress = mailFrom.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  const email = stripQuotes(
    process.env.BREVO_FROM_EMAIL || namedAddress?.[2] || mailFrom
  );
  const name = stripQuotes(
    process.env.BREVO_FROM_NAME ||
      namedAddress?.[1] ||
      process.env.APP_NAME ||
      'Walai Booking'
  );

  if (!email.includes('@')) {
    throw new Error('BREVO_FROM_EMAIL or MAIL_FROM must contain a valid sender email');
  }

  return { email, name };
};

// ส่งอีเมลผ่าน Brevo HTTPS API
const sendViaBrevo = async (payload: MailPayload): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is missing');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: getBrevoSender(),
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${body}`);
  }

  console.log(`[mail] Sent via Brevo API to ${payload.to}`);
};

// ส่งอีเมลผ่าน Resend HTTPS API
const sendViaResend = async (payload: MailPayload): Promise<boolean> => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || 'Walai Booking <onboarding@resend.dev>',
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }

  console.log(`[mail] Sent via Resend to ${payload.to}`);
  return true;
};

// สร้าง Nodemailer transporter สำหรับ Gmail SMTP
const createGmailTransporter = (secure: boolean): Transporter => {
  const port = secure ? 465 : 587;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user: getMailUser(),
      pass: getMailPass(),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
};

// สร้าง Nodemailer transporter สำหรับเซิร์ฟเวอร์ SMTP ทั่วไป
const createGenericTransporter = (): Transporter => {
  return nodemailer.createTransport({
    host: String(process.env.MAIL_HOST),
    port: Number(process.env.MAIL_PORT),
    secure: String(process.env.MAIL_SECURE || 'false') === 'true',
    auth: {
      user: getMailUser(),
      pass: getMailPass(),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
};

// ส่งอีเมลผ่าน SMTP โดยรองรับการสลับพอร์ตอัตโนมัติสำหรับ Gmail
const sendViaSmtp = async (payload: MailPayload): Promise<void> => {
  const missingEnv = getMissingMailEnv();
  if (missingEnv.length > 0) {
    throw new Error(`Missing mail configuration: ${missingEnv.join(', ')}`);
  }

  const host = String(process.env.MAIL_HOST || '');
  const isGmail = host.includes('gmail.com');
  const mailOptions: SendMailOptions = {
    from: getMailFrom(),
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  };

  if (!isGmail) {
    await createGenericTransporter().sendMail(mailOptions);
    console.log(`[mail] Sent via SMTP to ${payload.to}`);
    return;
  }

  const attempts = [true, false];
  let lastError: unknown;

  for (const secure of attempts) {
    try {
      await createGmailTransporter(secure).sendMail(mailOptions);
      console.log(`[mail] Sent via Gmail SMTP port ${secure ? 465 : 587} to ${payload.to}`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`[mail] Gmail SMTP port ${secure ? 465 : 587} failed:`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gmail SMTP send failed');
};

// เลือกผู้ให้บริการส่งอีเมลตามการตั้งค่าในตัวแปรสภาพแวดล้อม
const getMailProvider = (): 'brevo' | 'resend' | 'smtp' => {
  const explicit = stripQuotes(String(process.env.MAIL_PROVIDER || '')).toLowerCase();
  if (explicit === 'brevo') return 'brevo';
  if (explicit === 'smtp') return 'smtp';
  if (explicit === 'resend') return 'resend';

  if (process.env.BREVO_API_KEY?.trim()) return 'brevo';
  if (process.env.RESEND_API_KEY?.trim()) return 'resend';
  return 'smtp';
};

// ส่งอีเมลผ่านผู้ให้บริการที่เลือกไว้
const sendMailSafely = async (options: SendMailOptions): Promise<void> => {
  const payload: MailPayload = {
    to: String(options.to),
    subject: String(options.subject || ''),
    html: String(options.html || ''),
    text: options.text ? String(options.text) : undefined,
  };

  const provider = getMailProvider();
  console.log(`[mail] provider=${provider}`);

  if (provider === 'brevo') {
    await sendViaBrevo(payload);
    return;
  }

  if (provider === 'resend') {
    const sent = await sendViaResend(payload);
    if (!sent) {
      throw new Error('RESEND_API_KEY is missing');
    }
    return;
  }

  await sendViaSmtp(payload);
};

// ส่งอีเมลเชิญชวนให้ลูกค้ารีวิวหลังเช็คเอาท์
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
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 8px;">สวัสดี ${escapeHtml(recipientName)}</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
            ขอบคุณที่เลือกพัก <strong>${escapeHtml(params.roomName)}</strong> กับวลัย<br />
            ช่วง <strong>${params.checkIn}</strong> – <strong>${params.checkOut}</strong>
          </p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
            หวังว่าคุณจะได้รับประสบการณ์ที่ดี หากมีเวลา รบกวนรีวิวการเข้าพักของคุณสักนิดนะครับ — ความคิดเห็นของคุณมีค่ามากสำหรับเรา
          </p>
          <a href="${escapeHtml(params.reviewUrl)}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 24px;">
            เขียนรีวิว
          </a>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">หากคุณไม่ได้เข้าพักกับเรา สามารถละเว้นอีเมลนี้ได้</p>
        </div>
      </div>
    `,
  });
};

// ส่งอีเมลรหัส OTP สำหรับรีเซ็ตรหัสผ่าน
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
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 12px;">สวัสดี ${escapeHtml(recipientName)}</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 18px;">เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณานำรหัส OTP ด้านล่างไปกรอกในหน้าตั้งรหัสผ่านใหม่</p>
          <div style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 24px; border-radius: 14px; font-size: 28px; font-weight: 700; letter-spacing: 8px; margin-bottom: 24px;">${escapeHtml(params.otpCode)}</div>
          <div style="background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px; color: #4b5563; line-height: 1.7;">
            OTP นี้จะหมดอายุภายใน ${expiresInMinutes} นาที<br />
            หากคุณไม่ได้เป็นผู้ร้องขอ คุณสามารถละเว้นอีเมลนี้ได้อย่างปลอดภัย
          </div>
        </div>
      </div>
    `,
  });
};

// ส่งอีเมลแจ้งเตือนพนักงานเมื่อลูกค้าอัปโหลดสลิปชำระเงินใหม่
export const sendPaymentSlipNotificationEmail = async (params: {
  to: string;
  customerName: string;
  bookingType: 'room' | 'kayak';
  bookingId: number;
  amount: number;
  adminDashboardUrl: string;
}): Promise<void> => {
  const appName = process.env.APP_NAME || 'Walai Booking';
  const bookingTypeLabel = params.bookingType === 'room' ? 'ห้องพัก' : 'เรือคายัค';

  try {
    await sendMailSafely({
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
              ลูกค้า <strong>${escapeHtml(params.customerName)}</strong> ได้อัปโหลดสลิปการชำระเงินสำหรับการจอง${bookingTypeLabel}
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
              <div>📋 <strong>ประเภท:</strong> ${bookingTypeLabel}</div>
              <div>🔢 <strong>รหัสการจอง:</strong> #${params.bookingId}</div>
              <div>💰 <strong>ยอดชำระ:</strong> ฿${Number(params.amount).toLocaleString()}</div>
            </div>
            <a href="${escapeHtml(params.adminDashboardUrl)}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 16px;">
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

// ส่งอีเมลแจ้งลูกค้าเมื่อบันทึกคำขอจองสำเร็จและรอการชำระเงิน
export const sendBookingConfirmationEmail = async (params: {
  to: string;
  customerName: string;
  bookingType: 'room' | 'kayak';
  bookingId: number;
  details: string;
  dateInfo: string;
  totalPrice: number;
}): Promise<void> => {
  const appName = process.env.APP_NAME || 'Walai Booking';
  const bookingTypeLabel = params.bookingType === 'room' ? 'ห้องพัก' : 'เรือคายัค';

  try {
    await sendMailSafely({
      to: params.to,
      subject: `[${appName}] บันทึกคำขอจอง${bookingTypeLabel}แล้ว (รอชำระเงิน) — รหัส #${params.bookingId}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
            <div style="margin-bottom: 24px;">
              <div style="display: inline-block; background: #fef3c7; color: #b45309; font-weight: 700; padding: 8px 14px; border-radius: 999px; font-size: 13px;">⏳ รอชำระเงิน (ยังไม่ใช่การยืนยันการจอง)</div>
            </div>
            <h1 style="font-size: 22px; margin: 0 0 16px; color: #111827;">บันทึกคำขอจอง${bookingTypeLabel}แล้ว — กรุณาดำเนินการชำระเงิน</h1>
            <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
              สวัสดีคุณ <strong>${escapeHtml(params.customerName)}</strong><br />
              ระบบได้บันทึกคำขอจอง${bookingTypeLabel}ของคุณเรียบร้อยแล้ว <strong>(อีเมลนี้ยังไม่ใช่การยืนยันการจอง)</strong> กรุณาดำเนินการชำระเงินและแนบสลิปผ่านเว็บไซต์ เพื่อให้เจ้าหน้าที่ตรวจสอบและยืนยันการจอง รายละเอียดดังนี้:
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 14px; line-height: 1.8;">
              <div>📋 <strong>รหัสการจอง:</strong> #${params.bookingId}</div>
              <div>🏠 <strong>รายการ:</strong> ${escapeHtml(params.details)}</div>
              <div>📅 <strong>วันที่:</strong> ${escapeHtml(params.dateInfo)}</div>
              <div>💰 <strong>ราคารวม:</strong> ฿${Number(params.totalPrice).toLocaleString()}</div>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px; margin-bottom: 24px; font-size: 13px; color: #92400e; line-height: 1.6;">
              ⚠️ <strong>สำคัญ:</strong> รายการจองนี้จะเสร็จสมบูรณ์เมื่อท่านชำระเงิน แนบสลิป และได้รับการตรวจสอบอนุมัติจากเจ้าหน้าที่แล้วเท่านั้น
            </div>
            <a href="${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/dashboard?tab=bookings" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 16px;">
              ไปหน้าประวัติการจอง & แนบสลิป →
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

// ส่งอีเมลแจ้งผลการอนุมัติหรือปฏิเสธการจองให้ลูกค้าทราบ
export const sendBookingStatusEmail = async (params: {
  to: string;
  customerName: string;
  bookingType: 'room' | 'kayak';
  bookingId: number;
  status: 'approved' | 'rejected';
  details: string;
  rejectReason?: string | null;
}): Promise<void> => {
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
    await sendMailSafely({
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
              สวัสดีคุณ <strong>${escapeHtml(params.customerName)}</strong><br />
              ${isApproved ? 'พนักงานได้ตรวจสอบและยืนยันการจองเรียบร้อยแล้ว ยินดีต้อนรับสู่สวนวลัยครับ 🌊' : 'พนักงานปฏิเสธรายการจองนี้แล้ว ไม่สามารถชำระเงินหรือส่งสลิปซ้ำในรายการเดิมได้ กรุณาติดต่อพนักงานเพื่อสอบถามการดำเนินการต่อและการคืนเงิน หากได้โอนเงินแล้ว'}
            </p>
            <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
              <div>📋 <strong>รหัสการจอง:</strong> #${params.bookingId}</div>
              <div>🏠 <strong>รายการ:</strong> ${escapeHtml(params.details)}</div>
              <div>📌 <strong>สถานะปัจจุบัน:</strong> ${isApproved ? 'ยืนยันการจองแล้ว (Approved)' : 'ปฏิเสธ (Rejected)'}</div>
              ${!isApproved ? `<div><strong>เหตุผลที่ถูกปฏิเสธ:</strong> ${escapeHtml(params.rejectReason?.trim() || 'กรุณาติดต่อพนักงานเพื่อสอบถามรายละเอียด')}</div>` : ''}
            </div>
            <a href="${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/dashboard?tab=bookings" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 16px;">
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

// ส่งอีเมลแจ้งเตือนลูกค้าเมื่อคูปองส่วนลดที่เก็บไว้ใกล้หมดอายุ
export const sendPromotionExpiryEmail = async (params: {
  to: string;
  recipientName?: string;
  promoName: string;
  code: string;
  endDate: string;
  daysLeft: number;
  promoUrl: string;
}): Promise<void> => {
  const appName = process.env.APP_NAME || 'Walai Booking';
  const recipientName = params.recipientName?.trim() || 'คุณลูกค้า';
  const when = params.daysLeft === 0 ? 'วันนี้เป็นวันสุดท้าย (ใช้ได้ถึงเที่ยงคืน)' : `เหลืออีก ${params.daysLeft} วัน`;

  await sendMailSafely({
    from: getMailFrom(),
    to: params.to,
    subject: `โปรโมชั่น ${params.code} ของคุณใกล้หมดอายุแล้ว — ${appName}`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-block; background: #ccfbf1; color: #0f766e; font-weight: 700; padding: 10px 14px; border-radius: 999px;">${escapeHtml(appName)}</div>
          </div>
          <h1 style="font-size: 22px; margin: 0 0 12px; color: #111827;">โปรโมชั่นของคุณใกล้หมดอายุ</h1>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 8px;">สวัสดี ${escapeHtml(recipientName)}</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
            โปรโมชั่น <strong>${escapeHtml(params.code)}</strong> (${escapeHtml(params.promoName)}) ${when}<br />
            วันสิ้นสุด <strong>${escapeHtml(params.endDate)}</strong>
          </p>
          <a href="${escapeHtml(params.promoUrl)}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 14px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; text-decoration: none; margin-bottom: 24px;">
            ใช้โปรโมชั่น
          </a>
          <p style="font-size: 13px; color: #9ca3af; margin: 0;">ไม่ต้องการรับอีเมลแจ้งเตือนโปรโมชั่น? <a href="${escapeHtml(params.promoUrl)}" style="color: #0f766e;">ปิดการรับอีเมลได้ที่นี่</a></p>
        </div>
      </div>
    `,
  });
};
