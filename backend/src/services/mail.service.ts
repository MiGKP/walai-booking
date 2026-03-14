import nodemailer from 'nodemailer';

const requiredMailEnv = ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS'] as const;

const getMissingMailEnv = () => {
  return requiredMailEnv.filter((key) => !process.env[key]);
};

const getMailFrom = () => {
  return process.env.MAIL_FROM || `${process.env.APP_NAME || 'Walai Booking'} <${process.env.MAIL_USER}>`;
};

const createTransporter = () => {
  const missingEnv = getMissingMailEnv();
  if (missingEnv.length > 0) {
    throw new Error(`Missing mail configuration: ${missingEnv.join(', ')}`);
  }

  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: String(process.env.MAIL_SECURE || 'false') === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
};

export const sendReviewReminderEmail = async (params: {
  to: string;
  recipientName?: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  reviewUrl: string;
}) => {
  const transporter = createTransporter();
  const appName = process.env.APP_NAME || 'Walai Booking';
  const recipientName = params.recipientName?.trim() || 'คุณลูกค้า';
  await transporter.verify();

  await transporter.sendMail({
    from: getMailFrom(),
    to: params.to,
    subject: `ขอบคุณที่เข้าพักกับ ${appName} — รบกวนรีวิวสักนิดนะครับ 🙏`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f7fb; padding: 24px; color: #1f2937;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e5e7eb;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-block; background: #ccfbf1; color: #0f766e; font-weight: 700; padding: 10px 14px; border-radius: 999px;">${appName}</div>
          </div>
          <h1 style="font-size: 22px; margin: 0 0 12px; color: #111827;">ขอบคุณที่เข้าพักกับเรา 🌊</h1>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 8px;">สวัสดี ${recipientName}</p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
            ขอบคุณที่เลือกพัก <strong>${params.roomName}</strong> กับวลัย<br />
            ช่วง <strong>${params.checkIn}</strong> – <strong>${params.checkOut}</strong>
          </p>
          <p style="font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
            หวังว่าคุณจะได้รับประสบการณ์ที่ดี หากมีเวลา รบกวนรีวิวการเข้าพักของคุณสักนิดนะครับ — ความคิดเห็นของคุณมีค่ามากสำหรับเรา ⭐
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
}) => {
  const transporter = createTransporter();
  const appName = process.env.APP_NAME || 'Walai Booking';
  const recipientName = params.recipientName?.trim() || 'คุณลูกค้า';
  const expiresInMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30');
  await transporter.verify();

  await transporter.sendMail({
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
