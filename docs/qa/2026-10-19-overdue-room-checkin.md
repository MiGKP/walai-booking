# Overdue room arrivals

## Approved behavior

- Separate Today, Tomorrow, Overdue and All arrival filters. Use Bangkok calendar dates.
- Highlight approved room lines whose arrival date has passed. Do not automatically change booking/payment status.
- Allow late check-in only before the checkout date, after explicit confirmation. Record the actual current timestamp and responsible staff member; do not backdate attendance.
- On or after the checkout date, show an outstanding-record review dialog instead of check-in. Staff can inspect the stay and open the existing rejection dialog if the whole booking remains eligible.
- Future bookings are preparation items; they cannot be checked in early through this flow.

## API

`PUT /api/bookings/booking-rooms/:bookingRoomId/checkin`

Late arrival requires JSON `{ "confirm_late_checkin": true }`. The validator rejects string/array/numeric confirmations. Normal same-day arrival keeps the optional field backward compatible.

The controller independently checks arrival/checkout dates after locking the booking header and room line. Existing terminal-status checks and transaction ordering remain intact.

## Verification

- Frontend regression covers detailed and compact cards, all four filters, expired and late stays, future arrivals and the UTC-to-Bangkok date boundary.
- Backend regression covers normal, late, unconfirmed, future and expired check-ins, plus confirmation validation.
- Local PostgreSQL integration covers date guards, actual timestamp/staff persistence, concurrent late check-in, check-in versus cancellation, and concurrent final checkouts.
- Backend/frontend production builds and regression suites pass.

No production bookings or dates were modified during development. No schema migration is required.
