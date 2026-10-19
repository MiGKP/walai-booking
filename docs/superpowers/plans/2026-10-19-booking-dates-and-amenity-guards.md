# Booking dates and amenity guards

**Goal:** Address examination feedback on same-day room bookings, explicit check-out selection, and preventing deletion of referenced amenities.

**Constraints:** Preserve room capacity, price, payment and role rules; no schema or booking-status changes; do not commit or deploy without a new request.

## Implementation

- [x] Reproduce the automatic check-out selection with tests of the actual calendar component.
- [x] Represent an unfinished range as a selected start with an empty end. Show only selected dates, with check-in/check-out instructions, and require a positive stay before room selection or search.
- [x] Remove default check-out dates and make clearing dates truly clear the selection across room list, room detail and cart calendar.
- [x] User confirmed same-day booking for customers and staff when stock is available; retain Bangkok date boundaries and the existing API availability/transaction checks.
- [x] Reproduce deletion of an amenity referenced by a room type. Return 409 without mutating references. Coordinate creation/update of references with deletion using row locks.
- [x] Show amenity usage and explain disabled deletion in the admin interface.
- [x] Run backend/frontend regression suites and builds. Inspect UI behavior without mutating production bookings or deleting production amenities.

Validation details: `docs/qa/2026-10-19-booking-dates-and-amenities.md`.
