# Multi-Kayak Booking Design

## Problem

Today one `boat_bookings` row equals one boat type, one date, one round, and one payment. Groups that need several kayak types (or many seats split across boats) must book and pay separately. The product need is: multiple boat types in one checkout, one payment, shared date and time round, with clear “passengers → boats needed” math.

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Date / round | One date + one time window for the whole group |
| Passengers | Enter passengers **per boat type**; system computes boat count |
| Boat count | `ceil(num_passengers / seat_count)` shown to the user |
| Payment / staff | One payment; approve/reject whole booking once (same idea as rooms) |
| Schema pattern | Header `boat_bookings` + line table `booking_boat` (mirror `room_bookings` / `booking_room`) |

## Important domain note

`boat_rounds` rows are **per `boat_type_id`**. A shared “round” means the same `start_time` + `end_time` across types, not a shared `boat_round_id`. Pool capacity (`total_slots`) is already checked across types that share that time window.

## Out of scope

- Admin room zone / room-number UX (feature E)
- Redesigning how rounds are stored globally
- Per-line check-out in v1 (group check-out first; per-line optional later)

## Architecture

```text
boat_bookings (1)           ← booking header (date, time window, payment, group status)
    └── booking_boat (m)    ← one row per boat type in the group
```

Single-type bookings become header + one line after migration.

### `boat_bookings` (header — evolve)

| Column | Notes |
| --- | --- |
| `boat_booking_id` | PK; payment key stays `kayak_{id}` |
| `member_id` | Customer |
| `booking_date` | Shared date |
| `start_time`, `end_time` | Shared time window (new columns; derived from chosen rounds) |
| `num_passengers` | Sum of line passengers |
| `total_price` | Sum of line subtotals (promo later if added) |
| `payment_*`, `status`, `approved_by_staff_id` | Stay on header |
| `boat_type_id`, `boat_round_id` | **Move to lines** after backfill (drop from header) |

Header status: `pending | paid | approved | rejected | cancelled | checked_out` (group check-out sets header + all lines).

### `booking_boat` (new)

| Column | Notes |
| --- | --- |
| `booking_boat_id` | PK |
| `boat_booking_id` | FK → header |
| `boat_type_id` | FK → `boat_types` |
| `boat_round_id` | FK → `boat_rounds` for that type at the shared time |
| `num_passengers` | Passengers for this type |
| `boat_count` | `ceil(num_passengers / seat_count)` |
| `unit_price` | Snapshot of boat type price at booking |
| `subtotal` | Price for this line (define as `unit_price * boat_count` unless existing product prices per passenger — keep consistent with current single-booking pricing) |
| `status` | Follows header in v1 |

Indexes: `(boat_booking_id)`, `(boat_round_id, status)`, `(booking_date via join)` as needed for availability.

### Pricing note

Current create path stores `total_price` from type `price` once per booking. Multi-type v1 uses:

- `subtotal = unit_price * boat_count`
- Header `total_price = sum(subtotals)`

If product later prices per passenger, change both single and multi paths together.

### Availability rules (create transaction)

For each item:

1. Resolve `boat_round` for `(boat_type_id, start_time, end_time)` active.
2. Compute `boat_count`.
3. Enforce type capacity / `max_booking` using existing semantics, counting **boats** (or passengers) the same way inventory is counted today — prefer counting `boat_count` against remaining type stock and against shared `total_slots` for that time window.
4. If any item fails → full rollback + clear message naming the boat type.

## Customer UX

1. Pick date on calendar.
2. Pick a time round (shown as a shared slot list; slots exist if at least one type has that time, or show slots from selected types).
3. For each boat type card: enter passengers → live text “ต้องใช้ X ลำ” + estimated price.
4. Add types into a summary panel; remove/edit passengers.
5. Confirm → create header + lines → `/payment?booking_type=kayak&booking_id=...`.

Changing date or time clears the cart (or confirms clear).

## Staff / admin UX

- Primary row = header (`boat_bookings`).
- Expand = `booking_boat` lines (type name, passengers, boat_count, subtotal).
- Approve / reject / cancel on header syncs all lines.
- Check-out on header sets all lines + header to `checked_out` (v1).

## API

### Create — extend existing kayak booking create

New body:

```json
{
  "booking_date": "2026-08-20",
  "start_time": "09:00:00",
  "end_time": "10:00:00",
  "items": [
    { "boat_type_id": 1, "num_passengers": 3 },
    { "boat_type_id": 3, "num_passengers": 2 }
  ]
}
```

Legacy shorthand remains:

```json
{
  "kayak_id": 1,
  "booking_date": "2026-08-20",
  "boat_round_id": 10,
  "num_passengers": 2
}
```

Maps to one line; header times taken from that round.

Response `201`: header + `boats: BookingBoatLine[]`.

### Payment / status

- Slip upload on header id; sync lines to `paid`.
- Status update on header; sync lines.
- Cancel pending header; sync lines.

### Reads

List/detail include nested `boats` JSON (type name, passengers, boat_count, subtotal, status).

## Migration plan

1. Create `booking_boat`.
2. Add `start_time`, `end_time` on `boat_bookings` (backfill from joined round).
3. Backfill one `booking_boat` per legacy header (`boat_count` from `ceil(num_passengers / seat_count)` or `1` minimum).
4. Point app at lines.
5. Drop `boat_bookings.boat_type_id` and `boat_bookings.boat_round_id`.
6. Update calendar / availability queries that assumed one type per booking row to sum `boat_count` (or passenger rules) from lines.

## Error handling

| Case | Response |
| --- | --- |
| No matching round for a type at that time | `400` / `409` with type name |
| Not enough stock / slots | `409` |
| Empty items / invalid passengers | `400` |
| Partial failure | Full rollback |

## Testing checklist

1. Legacy single kayak book → pay → approve → check-out.
2. Two types, same date/time, passengers force `boat_count > 1` → one payment.
3. Missing round for one type → no header created.
4. Pool `total_slots` still blocks overbook.
5. Admin list shows nested boats.
6. Backend + frontend build.

## Files likely touched

- `backend/src/db/migrations/2026-08-09-booking-boat.sql` (or dated migration)
- `backend/src/controllers/kayak.controller.ts`, payment, validators, routes
- `frontend/src/app/kayaks/page.tsx` (+ small cart helper if useful)
- `frontend/src/app/admin/boats/page.tsx`, staff boat dashboard if separate
- `AGENTS.md` / README table list

## Open points (non-blocking)

- Exact inventory unit for `max_booking` after multi-line (boats vs bookings vs passengers) — align with current SQL when implementing.
- Whether shared slot picker lists times from all active types or only types already in cart.
