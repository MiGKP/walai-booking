import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import bookingRoutes from './routes/booking.routes';
import kayakRoutes from './routes/kayak.routes';
import paymentRoutes from './routes/payment.routes';
import uploadRoutes from './routes/upload.routes';
import reviewRoutes from './routes/review.routes';
import settingsRoutes from './routes/settings.routes';
import promotionRoutes from './routes/promotion.routes';

import './config/passport';
import { startReviewReminderJob } from './services/review-reminder.service';
import { startAutoCancelJob } from './services/auto-cancel.service';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS check: origin =', origin, 'FRONTEND_URL =', process.env.FRONTEND_URL);
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.FRONTEND_URL === origin) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: origin = ${origin}, FRONTEND_URL = ${process.env.FRONTEND_URL}`));
    }
  },
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth attempts, please try again later.',
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error('SESSION_SECRET environment variable is not set');

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/kayaks', kayakRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/promotions', promotionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Walai Booking API is running' });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`🌊 Walai Booking API running on port ${PORT}`);
  startReviewReminderJob();
  startAutoCancelJob();
});

export default app;
