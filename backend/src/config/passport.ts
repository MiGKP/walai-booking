import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import pool from './database';
import dotenv from 'dotenv';

dotenv.config();

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'walai_super_secret_jwt_key_change_in_production',
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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
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

passport.serializeUser((user: any, done) => {
  // Handle both members and staff
  const id = user.member_id || user.staff_id;
  done(null, id);
});

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

export default passport;
