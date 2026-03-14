import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import pool from './database';
import dotenv from 'dotenv';

dotenv.config();

// กลยุทธ์ JWT ใช้ตรวจสอบ token ของผู้ใช้ทุกครั้งที่เรียก protected route และดึงข้อมูล user จริงจากฐานข้อมูลอีกชั้น
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is not set'); })(),
    },
    // callback นี้จะทำงานหลังจากถอด JWT สำเร็จ เพื่อยืนยันว่า user ใน token ยังมีอยู่จริงในระบบ
    async (payload, done) => {
      try {
        let result;
        if (payload.role === 'customer') {
          result = await pool.query('SELECT * FROM members WHERE member_id = $1', [payload.id]);
        } else {
          result = await pool.query('SELECT * FROM staff WHERE staff_id = $1', [payload.id]);
        }
        
        if (result.rows.length === 0) return done(null, false);
        return done(null, result.rows[0]);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// กลยุทธ์ Google OAuth ใช้รับข้อมูลโปรไฟล์จาก Google แล้วหรือลงทะเบียน member ให้โดยอัตโนมัติ
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
    // callback นี้เป็นหัวใจของ social login โดยจะ map บัญชี Google ให้ตรงกับ member ในฐานข้อมูล
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatar = profile.photos?.[0]?.value;

        if (!email) return done(new Error('No email from Google'), false);

        // Check in members table
        const existing = await pool.query('SELECT * FROM members WHERE google_id = $1 OR email = $2', [
          profile.id,
          email,
        ]);

        if (existing.rows.length > 0) {
          const user = existing.rows[0];
          // If this email was registered via email/password, block Google login to prevent account merge
          if (user.auth_provider === 'email' && !user.google_id) {
            return done(new Error('This email is already registered. Please login with your email and password.'), false);
          }
          // If already linked to Google or has google_id, allow login
          if (!user.google_id) {
            await pool.query('UPDATE members SET google_id = $1, avatar_url = $2 WHERE member_id = $3', [
              profile.id,
              avatar,
              user.member_id,
            ]);
          }
          return done(null, user);
        }

        // Create new member
        const nameParts = profile.displayName?.split(' ') || ['', ''];
        const newUser = await pool.query(
          `INSERT INTO members (first_name, last_name, email, google_id, avatar_url, auth_provider)
           VALUES ($1, $2, $3, $4, $5, 'google') RETURNING *`,
          [nameParts[0] || '', nameParts[1] || '', email, profile.id, avatar]
        );

        return done(null, newUser.rows[0]);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// serialize ใช้เก็บ id ของผู้ใช้ลง session เมื่อ Passport ต้องจัดการ session-based auth
passport.serializeUser((user: any, done) => {
  // Handle both members and staff
  const id = user.member_id || user.staff_id;
  done(null, id);
});

// deserialize ใช้ดึงข้อมูลผู้ใช้กลับจาก id ที่เก็บไว้ใน session เมื่อมี request ครั้งถัดไป
passport.deserializeUser(async (id: number, done) => {
  try {
    // Try members first, then staff
    let result = await pool.query('SELECT * FROM members WHERE member_id = $1', [id]);
    if (result.rows.length === 0) {
      result = await pool.query('SELECT * FROM staff WHERE staff_id = $1', [id]);
    }
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error, null);
  }
});

// export passport instance ที่ถูกติดตั้ง strategy แล้ว เพื่อใช้ใน route และไฟล์เริ่มต้นของเซิร์ฟเวอร์
export default passport;
