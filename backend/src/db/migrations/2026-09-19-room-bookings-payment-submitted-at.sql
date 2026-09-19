-- Additive only. Tracks the moment the customer successfully submits a payment slip
-- (uploadPaymentSlip), independent of `payment_date` (which is only set later, when staff
-- approves the booking) and independent of `updated_at` (which gets overwritten by every
-- later status change, e.g. approve/reject/checkout). Used to power "ยอดจองวันนี้" as a
-- rolling 24h count of completed payment transactions per room type.

ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMP;
