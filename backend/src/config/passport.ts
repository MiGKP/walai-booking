import { legacyAuthEmail } from '../services/auth-email';
import passport from 'passport';
import { Profile, Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import pool from './database';
import dotenv from 'dotenv';
import {
  extractGoogleAvatar,
  extractGoogleEmail,
  extractGoogleName,
} from '../services/google-oauth.profile';

dotenv.config();

// กลยุทธ์ตรวจสอบ JWT token และดึงข้อมูลผู้ใช้จากฐานข้อมูล
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is not set'); })(),
    },
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

// กลยุทธ์เข้าสู่ระบบด้วย Google OAuth และผูกหรือสร้างบัญชีสมาชิกอัตโนมัติ
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
      try {
        const email = extractGoogleEmail(profile);
        const avatar = extractGoogleAvatar(profile);

        if (!email) {
          return done(null, false, { message: 'no_email' });
        }

        const existing = await pool.query(
          `SELECT * FROM members
           WHERE google_id = $1 OR ((google_id IS NULL OR google_id = $1) AND (LOWER(email) = LOWER($2) OR (LOWER(email) = LOWER($3) AND NOT EXISTS (SELECT 1 FROM members exact WHERE LOWER(exact.email) = LOWER($2)))))
           ORDER BY CASE WHEN google_id = $1 THEN 0 WHEN LOWER(email) = LOWER($2) THEN 1 ELSE 2 END
           LIMIT 1`,
          [profile.id, email, legacyAuthEmail(email ?? "")]
        );

        if (existing.rows.length > 0) {
          const user = existing.rows[0] as { member_id: number; google_id: string | null; is_active: boolean };
          if (user.is_active === false) {
            return done(null, false, { message: 'account_disabled' });
          }
          if (!user.google_id) {
            await pool.query(
              `UPDATE members
               SET google_id = $1,
                   avatar_url = COALESCE($2, avatar_url),
                   updated_at = NOW()
               WHERE member_id = $3`,
              [profile.id, avatar, user.member_id]
            );
          }
          return done(null, existing.rows[0]);
        }

        const { firstName, lastName } = extractGoogleName(profile, email);
        const newUser = await pool.query(
          `INSERT INTO members (first_name, last_name, email, google_id, avatar_url, auth_provider)
           VALUES ($1, $2, $3, $4, $5, 'google') RETURNING *`,
          [firstName, lastName, email, profile.id, avatar]
        );

        return done(null, newUser.rows[0]);
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';
        if (code === '23505') {
          const email = extractGoogleEmail(profile);
          const retry = await pool.query(
            `SELECT * FROM members
             WHERE google_id = $1 OR ($2::text IS NOT NULL AND google_id IS NULL AND (LOWER(email) = LOWER($2) OR (LOWER(email) = LOWER($3) AND NOT EXISTS (SELECT 1 FROM members exact WHERE LOWER(exact.email) = LOWER($2)))))
             LIMIT 1`,
            [profile.id, email, legacyAuthEmail(email ?? "")]
          );
          if (retry.rows.length > 0) {
            return done(null, retry.rows[0]);
          }
        }
        console.error('Google verify error:', error);
        return done(null, false, { message: 'google_failed' });
      }
    }
  )
);

// เก็บรหัสผู้ใช้ลงใน session
passport.serializeUser((user: Express.User, done) => {
  const record = user as { member_id?: number; staff_id?: number };
  const id = record.member_id || record.staff_id;
  done(null, id);
});

// ดึงข้อมูลผู้ใช้จากรหัสที่เก็บไว้ใน session
passport.deserializeUser(async (id: number, done) => {
  try {
    let result = await pool.query('SELECT * FROM members WHERE member_id = $1', [id]);
    if (result.rows.length === 0) {
      result = await pool.query('SELECT * FROM staff WHERE staff_id = $1', [id]);
    }
    done(null, result.rows[0] || null);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
