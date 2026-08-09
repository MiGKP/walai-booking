# Multi-Room Booking Design

## Problem

Today one `room_bookings` row equals one physical room and one payment. Guests who need several rooms (possibly different types) must create separate bookings and pay separately. The product requirement is: multiple room types in one checkout, one payment slip, shared check-in / check-out dates.

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Room types | Multiple types allowed in one booking |
| Payment | One payment / one slip for the whole booking |
| Dates | Same check-in and check-out for every room |
| UX entry | Hybrid: add from `/rooms` list and from room detail |
| Guests | Adults + children once for the whole group |
| Capacity | Guests total must be ≤ sum of capacities of selected rooms |
| Staff actions | Approve / reject whole booking once; check-out per physical room |
| Schema naming | Match existing ERD: `room_bookings` = header, `booking_room` = line items |

## Out of scope

- Dual-month calendar UI
- Promo price breakdown display (full / discount / pay)
- Multi kayak-type booking and seat splitting
- Admin zone + room-number management UX

## Architecture

Header–detail model aligned with the project ERD:

```text
room_bookings (1)          ← booking header (dates, guests, payment, status)
    └── booking_room (m)   ← one row per physical room assigned
```

Single-room bookings become the same shape: one header + one `booking_room` row. No separate code path required after migration.

### `room_bookings` (header — evolve existing table)

Keep as the customer-facing booking id used by payment (`room_{room_booking_id}`), history, and staff dashboards.

| Column | Notes |
| --- | --- |
| `room_booking_id` | PK (unchanged) |
| `member_id` | Customer |
| `check_in`, `check_out` | Shared dates |
| `adults`, `children` | New; group guest counts. Migrate from `guest_count` where needed |
| `guest_count` | Keep as generated/synced total (`adults + children`) for backward-compatible queries, or keep writing total into it |
| `total_price` | Sum of line `subtotal` values after promo |
| `special_request` | Group-level note |
| `promotion_id` | Optional; one code for the whole booking |
| `payment_status`, `payment_slip`, `payment_date` | Stay on header |
| `status` | `pending \| paid \| approved \| rejected \| cancelled` (group-level). Check-out is **not** stored on the header |
| `approved_by_staff_id` | Set when staff approves/rejects the group |
| `room_id` | **Remove after migrate** (moved to `booking_room`) |

### `booking_room` (new — line items)

| Column | Notes |
| --- | --- |
| `booking_room_id` | PK |
| `room_booking_id` | FK → `room_bookings` |
| `room_id` | FK → `rooms` (physical unit) |
| `price_per_night` | Snapshot at booking time |
| `nights` | Snapshot (`check_out - check_in`); same for all lines in a booking |
| `subtotal` | `price_per_night * nights` (before group promo allocation if any) |
| `status` | Follows header for pending/paid/approved/rejected/cancelled; may become `checked_out` independently |
| `checkout_at` | Set when that room is checked out |

Indexes: `(room_booking_id)`, `(room_id, status)` for availability checks.

### Status rules

| Event | Header `room_bookings.status` | Each `booking_room.status` |
| --- | --- | --- |
| Create | `pending` | `pending` |
| Slip uploaded | `paid` | `paid` |
| Staff approve | `approved` | `approved` |
| Staff reject | `rejected` | `rejected` |
| Customer cancel | `cancelled` | `cancelled` |
| Staff check-out one room | unchanged (still `approved` until all rooms done — optional later: derive “fully checked out”) | that row → `checked_out` |

Room inventory trigger currently keys off `room_bookings`. After migration it must key off `booking_room` (or both during transition): set `rooms.status = occupied` when line is approved; `available` on cancel/reject/check-out.

Price trigger `calculate_booking_price` currently runs on `room_bookings` insert. After migration, compute line `subtotal` in application or a trigger on `booking_room`, then set header `total_price` = sum(lines) minus promo.

## Customer UX

### Cart (hybrid)

1. User selects shared date range (calendar on `/rooms` or detail).
2. Adds room types + quantities from list and/or “เพิ่มเข้าการจอง” on detail.
3. Cart panel (sticky/drawer) shows: dates, lines (type × qty), adults/children, capacity used vs required, estimated total.
4. Changing dates prompts confirm then clears cart (availability depends on range).
5. Checkout validates capacity and stock, then creates booking and redirects to payment.

### Single-room shortcut

If cart empty and user clicks book on detail with quantity 1, create header + one `booking_room` (same API).

### Payment

Unchanged URL shape: `/payment?booking_type=room&booking_id={room_booking_id}`. Amount = header `total_price`. One slip updates header and syncs line statuses to `paid`.

### History

One card per `room_bookings` header; expand to list physical rooms / types / subtotals.

## Staff / admin UX

- Primary table row = header booking.
- Expandable detail = `booking_room` lines (room number, type, subtotal, line status).
- Approve / reject buttons on header only → update all non-terminal lines.
- Check-out button per line when header is `approved` and line is not yet `checked_out`.
- Action-column rule still applies: check status before slip (existing dashboard gotcha).

## API

### Create booking — `POST /api/bookings/room`

Accepted body (new shape; old single-type body remains as shorthand):

```json
{
  "check_in_date": "2026-08-20",
  "check_out_date": "2026-08-22",
  "adults": 2,
  "children": 1,
  "special_requests": "...",
  "promotion_id": null,
  "items": [
    { "room_type_id": 1, "quantity": 2 },
    { "room_type_id": 3, "quantity": 1 }
  ]
}
```

Shorthand (maps to one item quantity 1):

```json
{
  "room_type_id": 1,
  "check_in_date": "...",
  "check_out_date": "...",
  "guests": 2,
  "special_requests": "...",
  "promotion_id": null
}
```

Server steps (single DB transaction):

1. Validate dates, adults ≥ 1, items non-empty, quantities ≥ 1.
2. Load room types; compute total capacity × qty; reject if `adults + children > capacitySum`.
3. For each item, lock `quantity` available rooms with `FOR UPDATE SKIP LOCKED` (same overlap rules as today). If any shortfall → rollback + `409`.
4. Insert `room_bookings` header (`pending`).
5. Insert each `booking_room` with price snapshot and `subtotal`.
6. Apply promotion to header `total_price` if provided; bump `usage_count`.
7. Commit; fire-and-forget confirmation email listing all rooms; return header (+ lines).

### Payment

Existing payment endpoints operate on `room_booking_id` (header). Slip upload sets header + all lines to `paid`.

### Status

- Update status endpoint targets header id; syncs all lines (except already `checked_out` if that edge appears).
- Check-out endpoint targets `booking_room_id` (new param or route); frees that physical room.

### Reads

List/detail queries join `booking_room` + `rooms` + `room_types` and return nested `rooms: [...]` for UI.

### Availability / calendar

Calendar APIs stay date × type availability. Cart must not oversell: create path re-checks with locks. Optional later: pass intended cart quantities into search UI.

## Migration plan

1. Create `booking_room` table + FKs + indexes.
2. Backfill: for every existing `room_bookings` row with `room_id`, insert one `booking_room` (derive `nights`, `price_per_night` from type/price history best-effort, `subtotal` from `total_price` if single-line).
3. Add `adults` / `children` (default from `guest_count` / 0).
4. Update app code to read/write lines.
5. Drop `room_bookings.room_id` (and update triggers).
6. Verify single-room and multi-room flows; staff approve + per-room check-out.

## Error handling

| Case | Response |
| --- | --- |
| Not enough stock for a type | `409` + message which type failed |
| Guests exceed capacity sum | `400` |
| Invalid dates / empty items | `400` |
| Promo invalid | `400` (existing promo rules) |
| Partial lock failure | Full rollback |

Never leave a header without lines or lines without a committed header.

## Testing (manual / build)

1. Migrate + backfill; old bookings still show room number via join.
2. Book one room via shorthand; pay; staff approve; check-out.
3. Cart: two types, capacity OK; pay once; approve once; check-out each room.
4. Capacity oversum rejected.
5. Concurrent double-book same last room → one `409`.
6. Cancel pending group → all lines cancelled; rooms available.
7. `npm run build` backend + frontend.

## Files likely touched (implementation later)

- `backend` migration / seed; `booking.controller.ts`; payment; room status triggers; validators
- `frontend` rooms list + detail cart; payment (minor); dashboard bookings; admin/staff room dashboards
- `AGENTS.md` domain notes for header/detail

## Open points (non-blocking)

- Whether header gets a derived “all rooms checked out” display state without a new CHECK value
- How group promo is allocated across line `subtotal` for display (header discount is enough for v1)
- Exact cart persistence: session/`localStorage` vs server draft (recommend `localStorage` until checkout)
