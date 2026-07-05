# 🤖 AI Agent Guidelines & Project Architecture — Walai Booking System

This document serves as the technical reference and instructions for AI agents (such as Antigravity, Claude, ChatGPT, etc.) working on or inheriting the **Walai Booking** project.

---

## 📌 1. Project Overview & Repository Structure

The project is structured as a two-tier monorepo:
- **`./frontend`**: Next.js 16 (App Router, React 19, Tailwind CSS, Axios)
- **`./backend`**: Express.js (Node.js, TypeScript, PostgreSQL via `pg` pool, Nodemailer, Passport JWT)

> ⚠️ **CRITICAL COMMAND RULE**: There is NO `package.json` in the root workspace folder (`c:\Users\MiGKP\walai_booking`).
> Always execute npm/node commands inside `./frontend` or `./backend`.
> Example: To run frontend dev server, use `cd frontend; npm run dev`. To run backend, use `cd backend; npm run dev`.

---

## 🗄️ 2. Database Schema & Constraint Rules

The PostgreSQL database name is `walai`. Below are critical schema rules and triggers:

### Status Check Constraints
Both `room_bookings` and `boat_bookings` tables have explicit PostgreSQL `CHECK` constraints on the `status` column:
```sql
CHECK (status IN ('pending', 'paid', 'approved', 'rejected', 'cancelled', 'checked_out'))
```
> ⚠️ **GOTCHA**: NEVER attempt to set `status` to any value outside this list (e.g., `completed`, `finished`, `done`). Doing so will trigger PostgreSQL error `23514` (check constraint violation) and return a `500 Internal Server Error`.

### Database Triggers
1. **`calculate_booking_price`**:
   - Triggered on `INSERT` to `room_bookings`.
   - Computes `total_price` based on nightly rate from `room_types`, number of nights (`check_out - check_in`), and applies promo discount if `promotion_id` is passed.
2. **`update_room_status_on_booking`**:
   - Triggered on `INSERT` or `UPDATE` to `room_bookings`.
   - When `NEW.status = 'approved'` ➔ Updates `rooms.status = 'occupied'` for the assigned `room_id`.
   - When `NEW.status IN ('cancelled', 'rejected', 'checked_out')` ➔ Updates `rooms.status = 'available'` for the assigned `room_id`.

---

## 🔑 3. Authentication & Role Permissions

The system defines 4 user roles:

1. **`customer`**: Member accounts stored in `members` table.
   - Allowed: Browsing rooms/boats, making bookings, uploading payment slips, viewing own history (`/dashboard/bookings`), writing reviews.
2. **`room_staff`**: Staff accounts stored in `staff` table with `role = 'room_staff'`.
   - Allowed: Accessing Room Staff Dashboard (`/staff/rooms/dashboard`), reviewing room slips, approving/rejecting room bookings, checking out guests.
3. **`boat_staff`**: Staff accounts stored in `staff` table with `role = 'boat_staff'`.
   - Allowed: Accessing Boat Staff Dashboard (`/staff/boats/dashboard`), reviewing boat slips, approving/rejecting boat bookings, checking out boats.
4. **`admin`**: System administrator stored in `staff` table with `role = 'admin'`.
   - Allowed: Full access to all admin management modules (`/admin/...`), staff management, promotions, room/boat types, revenue stats, and viewing all bookings with staff approval names.

### Staff Approval Tracking
When a staff member or admin approves (`status = 'approved'`) or rejects (`status = 'rejected'`) a room or boat booking:
- The controller updates `approved_by_staff_id = req.user.id` in `room_bookings` or `boat_bookings`.
- Queries joining `members` and `staff` return `s.first_name || ' ' || s.last_name AS approved_by_name`.

---

## ✉️ 4. Email Notification Architecture

All mail logic is encapsulated in `backend/src/services/mail.service.ts` using Nodemailer (Gmail SMTP).

### Available Mail Functions:
- `sendBookingConfirmationEmail`: Sends booking summary and payment instructions to customer upon booking creation.
- `sendBookingStatusEmail`: Sends approval (`approved`) or rejection (`rejected`) notification to customer when staff updates status.
- `sendPaymentSlipNotificationEmail`: Notifies admins/staff when a new payment slip is uploaded.
- `sendReviewReminderEmail`: Sends review invitation email after check-out.
- `sendPasswordResetEmail`: Sends OTP code for password resets.

> ⚠️ **DEVELOPMENT PATTERN**: Mail functions must be invoked asynchronously using non-blocking IIFEs `(async () => { ... })()` inside controllers so that API HTTP responses return immediately without waiting for SMTP network latency.

---

## 🛡️ 5. Rate Limiting Guidelines

Rate limiting is configured in `backend/src/index.ts` using `express-rate-limit`:
- **General Limiter (`/api/`)**: Set to `max: 5000` requests per 15 minutes.
- **Auth Limiter (`/api/auth/login`, etc.)**: Set to `max: 20` requests per 15 minutes.

> ⚠️ **GOTCHA**: Do NOT reduce general rate limits below 1000 in development, as frequent frontend re-renders and multi-tab polling will cause HTTP `429 (Too Many Requests)` errors during dashboard usage.

---

## 🎨 6. Frontend UI & Dashboard Logic Rules

### Action Column Rendering in Dashboards
In dashboard pages (`frontend/src/app/admin/rooms/dashboard/page.tsx` and `frontend/src/app/admin/boats/dashboard/page.tsx`), render action buttons in this strict precedence:

```tsx
{b.status === 'approved' ? (
  <button onClick={() => handleCheckout(...)}>✅ Check-out</button>
) : b.status === 'checked_out' ? (
  <span className="...">เช็คเอาต์แล้ว</span>
) : b.status === 'rejected' ? (
  <span className="...">ปฏิเสธแล้ว</span>
) : b.status === 'cancelled' ? (
  <span className="...">ยกเลิกแล้ว</span>
) : b.payment_slip ? (
  <div className="flex gap-2">
    <button onClick={() => handleStatus(id, 'approved')}>ยืนยัน</button>
    <button onClick={() => handleStatus(id, 'rejected')}>ปฏิเสธ</button>
  </div>
) : (
  <span className="...">รอดำเนินการ</span>
)}
```
> ⚠️ **GOTCHA**: Checking `b.payment_slip` BEFORE checking `b.status === 'checked_out'` causes checked-out bookings with slips to re-render approve/reject buttons, causing an infinite loop where staff approves an already checked-out booking.

---

## 🧪 7. Build Verification & Quality Checks

Before completing any modifications:
1. Validate backend TypeScript compilation:
   ```bash
   cd backend
   cmd /c "npm run build"
   ```
2. Validate frontend build compilation:
   ```bash
   cd frontend
   cmd /c "npm run build"
   ```
3. Ensure no lint errors or missing imports exist.
