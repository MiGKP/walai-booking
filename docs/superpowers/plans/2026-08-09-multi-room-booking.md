# Multi-Room Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers book multiple rooms (mixed types) in one checkout with one payment, matching the ERD header `room_bookings` + line table `booking_room`.

**Architecture:** Evolve `room_bookings` into the booking header (dates, guests, payment, group status). Add `booking_room` rows for each physical room. Create API accepts `items[]` or legacy single `room_type_id`. Frontend cart (localStorage) feeds checkout. Staff approve/reject the header; check-out targets a `booking_room` line.

**Tech Stack:** PostgreSQL/Neon, Express + TypeScript, Next.js App Router, Axios, existing payment + Cloudinary slip flow.

**Spec:** `docs/superpowers/specs/2026-08-09-multi-room-booking-design.md`

## Global Constraints

- Table names must match ERD: header `room_bookings`, lines `booking_room` (singular).
- Multiple room types, one payment, shared check-in/out.
- Guests: adults + children on header; total ≤ sum of room capacities.
- Approve/reject whole booking; check-out per `booking_room`.
- Booking status CHECK values stay: `pending | paid | approved | rejected | cancelled | checked_out` — header never uses `checked_out`; lines may.
- Do not invent `checked_in` in this feature (if present in code without DB CHECK, do not expand it).
- Thai UI copy for customer surfaces; English for code/commits.
- Explicit return types; no `any`; use `getApiErrorMessage` on frontend.
- API errors `{ success: false, message: string }`.
- Out of scope: dual-month calendar, promo breakdown UI, multi-kayak, admin zone UX.
- Commit only when the user asks (plan steps that say commit are optional checkpoints).

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/db/migrations/2026-08-09-booking-room.sql` | Schema + backfill SQL to run in Neon |
| `backend/src/services/booking-room.math.ts` | Pure helpers: nights, capacity check, line subtotals |
| `backend/src/services/booking-room.math.test.ts` | Unit tests for helpers |
| `backend/src/middleware/validators.ts` | Accept `items[]` or legacy body |
| `backend/src/controllers/booking.controller.ts` | Create / list / cancel / status / check-out line |
| `backend/src/controllers/payment.controller.ts` | Slip updates header + sync lines |
| `backend/src/controllers/room.controller.ts` | Availability SQL uses `booking_room` |
| `backend/src/controllers/review.controller.ts` | Joins via header; eligible stay = all lines checked out or header approved+past (keep simple: header was checked_out historically — after migrate use “all lines checked_out”) |
| `backend/src/routes/booking.routes.ts` | New check-out-by-line route |
| `frontend/src/lib/room-cart.ts` | Cart types + localStorage |
| `frontend/src/components/booking/RoomCartPanel.tsx` | Cart UI |
| `frontend/src/app/rooms/page.tsx` | Add-to-cart |
| `frontend/src/app/rooms/[id]/page.tsx` | Add-to-cart + book |
| `frontend/src/app/dashboard/bookings/page.tsx` | Nested rooms |
| `frontend/src/app/admin/rooms/dashboard/page.tsx` | Expand lines + per-room check-out |
| `AGENTS.md` | Domain note header/detail |

---

### Task 1: Pure booking math helpers + tests

**Files:**
- Create: `backend/src/services/booking-room.math.ts`
- Create: `backend/src/services/booking-room.math.test.ts`

**Interfaces:**
- Produces: `nightsBetween(checkIn: string, checkOut: string): number`
- Produces: `sumCapacity(items: Array<{ capacity: number; quantity: number }>): number`
- Produces: `assertGuestsFitCapacity(adults: number, children: number, capacitySum: number): void` — throws `Error` with Thai/English message used by controller mapping
- Produces: `lineSubtotal(pricePerNight: number, nights: number): number`
- Produces: `sumSubtotals(subtotals: number[]): number`

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nightsBetween,
  sumCapacity,
  assertGuestsFitCapacity,
  lineSubtotal,
  sumSubtotals,
} from './booking-room.math';

describe('booking-room.math', () => {
  it('returns empty-safe nights for adjacent dates as 1', () => {
    assert.equal(nightsBetween('2026-08-20', '2026-08-21'), 1);
  });

  it('sums capacity across mixed types', () => {
    assert.equal(sumCapacity([{ capacity: 2, quantity: 2 }, { capacity: 4, quantity: 1 }]), 8);
  });

  it('throws when guests exceed capacity sum', () => {
    assert.throws(() => assertGuestsFitCapacity(6, 0, 4));
  });

  it('computes line subtotal and total', () => {
    assert.equal(lineSubtotal(1500, 2), 3000);
    assert.equal(sumSubtotals([3000, 2000]), 5000);
  });
});
```

- [ ] **Step 2: Run tests (expect fail)**

```bash
cd backend
npm run test:booking-room-math
```

Add script to `backend/package.json`:

```json
"test:booking-room-math": "node --test -r ts-node/register src/services/booking-room.math.test.ts"
```

Expected: module not found.

- [ ] **Step 3: Implement helpers**

```ts
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`);
  const b = new Date(`${checkOut}T00:00:00Z`);
  const nights = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (!Number.isFinite(nights) || nights < 1) {
    throw new Error('check_out_date must be after check_in_date');
  }
  return nights;
}

export function sumCapacity(items: Array<{ capacity: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + item.capacity * item.quantity, 0);
}

export function assertGuestsFitCapacity(adults: number, children: number, capacitySum: number): void {
  const total = adults + children;
  if (adults < 1) throw new Error('ต้องมีผู้ใหญ่อย่างน้อย 1 คน');
  if (total > capacitySum) {
    throw new Error(`ผู้เข้าพักรวม ${total} คน เกินความจุรวม ${capacitySum} คน`);
  }
}

export function lineSubtotal(pricePerNight: number, nights: number): number {
  return Number(pricePerNight) * nights;
}

export function sumSubtotals(subtotals: number[]): number {
  return subtotals.reduce((a, b) => a + b, 0);
}
```

- [ ] **Step 4: Re-run tests (expect pass)**

```bash
cd backend && npm run test:booking-room-math
```

---

### Task 2: Neon SQL migration + backfill

**Files:**
- Create: `backend/src/db/migrations/2026-08-09-booking-room.sql`

**Interfaces:**
- Produces: table `booking_room` with columns from spec
- Produces: columns `adults`, `children` on `room_bookings`
- Produces: backfill one `booking_room` per legacy header
- Produces: drop `room_bookings.room_id` after backfill (nullable first if safer)

- [ ] **Step 1: Write migration SQL file**

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS booking_room (
  booking_room_id SERIAL PRIMARY KEY,
  room_booking_id INTEGER NOT NULL REFERENCES room_bookings(room_booking_id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(room_id),
  price_per_night NUMERIC(10, 2) NOT NULL,
  nights INTEGER NOT NULL CHECK (nights >= 1),
  subtotal NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'approved', 'rejected', 'cancelled', 'checked_out')),
  checkout_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_room_booking ON booking_room(room_booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_room_room_status ON booking_room(room_id, status);

ALTER TABLE room_bookings
  ADD COLUMN IF NOT EXISTS adults INTEGER,
  ADD COLUMN IF NOT EXISTS children INTEGER NOT NULL DEFAULT 0;

UPDATE room_bookings
SET adults = GREATEST(COALESCE(guest_count, 1), 1)
WHERE adults IS NULL;

ALTER TABLE room_bookings
  ALTER COLUMN adults SET DEFAULT 1,
  ALTER COLUMN adults SET NOT NULL;

-- Backfill lines from legacy room_id on header
INSERT INTO booking_room (
  room_booking_id, room_id, price_per_night, nights, subtotal, status, checkout_at
)
SELECT
  rb.room_booking_id,
  rb.room_id,
  COALESCE(rt.price, rb.total_price),
  GREATEST((rb.check_out - rb.check_in), 1),
  COALESCE(rb.total_price, 0),
  CASE
    WHEN rb.status = 'checked_out' THEN 'checked_out'
    ELSE rb.status
  END,
  rb.checkout_at
FROM room_bookings rb
JOIN rooms r ON r.room_id = rb.room_id
JOIN room_types rt ON rt.id = r.room_type_id
WHERE rb.room_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM booking_room br WHERE br.room_booking_id = rb.room_booking_id
  );

-- Headers that were fully checked out: keep header as approved (group-level)
UPDATE room_bookings
SET status = 'approved'
WHERE status = 'checked_out';

ALTER TABLE room_bookings DROP COLUMN IF EXISTS room_id;

COMMIT;
```

Adjust column names (`room_types.price` vs `price_per_night`, `checkout_at`) against live Neon `\d room_bookings` / `\d room_types` before running. If a price trigger or FK blocks drop of `room_id`, make `room_id` nullable first, deploy app that stops writing it, then drop.

- [ ] **Step 2: Run in Neon SQL Editor on a backup/branch if possible; verify counts**

```sql
SELECT COUNT(*) FROM room_bookings;
SELECT COUNT(*) FROM booking_room;
SELECT status, COUNT(*) FROM room_bookings GROUP BY status;
SELECT status, COUNT(*) FROM booking_room GROUP BY status;
```

Expected: `booking_room` count ≈ legacy bookings that had `room_id`.

- [ ] **Step 3: Replace / recreate DB triggers**

Inspect live triggers that reference `room_bookings.room_id`. Replace occupancy logic to fire on `booking_room` status changes:

- `approved` → `rooms.status = 'occupied'`
- `cancelled` | `rejected` | `checked_out` → `rooms.status = 'available'`

Document exact `CREATE OR REPLACE FUNCTION` SQL in the same migration file after verifying current trigger definitions in Neon.

Price: stop relying on insert trigger on header for multi-line; app sets line `subtotal` and header `total_price` (Task 3). If old trigger errors without `room_id`, drop or rewrite it in this migration.

---

### Task 3: Validators + create booking (multi-item)

**Files:**
- Modify: `backend/src/middleware/validators.ts`
- Modify: `backend/src/controllers/booking.controller.ts`
- Modify: `backend/src/routes/booking.routes.ts` (only if needed)

**Interfaces:**
- Consumes: helpers from Task 1
- Produces: `createRoomBooking` accepts either legacy body or:

```ts
interface CreateRoomBookingBody {
  check_in_date: string;
  check_out_date: string;
  adults?: number;
  children?: number;
  guests?: number; // legacy → adults = guests, children = 0
  special_requests?: string;
  promotion_id?: number | null;
  room_type_id?: number; // legacy shorthand
  items?: Array<{ room_type_id: number; quantity: number }>;
}
```

- Response `201`: `{ success: true, message, data: { ...header, rooms: BookingRoomLine[] } }`

- [ ] **Step 1: Update validator**

Allow either `items` (array min 1) **or** `room_type_id`. Guests: either (`adults` + optional `children`) or legacy `guests`.

```ts
export const createRoomBookingValidator = [
  body('check_in_date').isISO8601()...,
  body('check_out_date').isISO8601()... /* after check_in */,
  body('items').optional().isArray({ min: 1 }),
  body('items.*.room_type_id').optional().isInt({ min: 1 }),
  body('items.*.quantity').optional().isInt({ min: 1, max: 20 }),
  body('room_type_id').optional().isInt({ min: 1 }),
  body('guests').optional().isInt({ min: 1, max: 50 }),
  body('adults').optional().isInt({ min: 1, max: 50 }),
  body('children').optional().isInt({ min: 0, max: 50 }),
  body('special_requests').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }),
  body('promotion_id').optional({ nullable: true }).isInt({ min: 1 }),
  body().custom((_, { req }) => {
    const hasItems = Array.isArray(req.body.items) && req.body.items.length > 0;
    const hasType = req.body.room_type_id != null;
    if (!hasItems && !hasType) throw new Error('items or room_type_id is required');
    if (req.body.guests == null && req.body.adults == null) {
      throw new Error('adults or guests is required');
    }
    return true;
  }),
];
```

- [ ] **Step 2: Rewrite `createRoomBooking`**

Pseudo-flow (implement fully in controller):

1. Normalize `items` from body or `[{ room_type_id, quantity: 1 }]`.
2. Normalize `adults` / `children` from body or `guests`.
3. `BEGIN`.
4. Load each room type (`id, price, capacity, status`); 404 if missing.
5. `assertGuestsFitCapacity` + `nightsBetween`.
6. For each item, loop `quantity` times: lock one available room with overlap query against **`booking_room` + header dates**:

```sql
SELECT r.room_id
FROM rooms r
WHERE r.room_type_id = $1 AND r.status <> 'maintenance'
  AND r.room_id NOT IN (
    SELECT br.room_id
    FROM booking_room br
    JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
    WHERE br.status NOT IN ('cancelled', 'rejected')
      AND rb.check_in < $3 AND rb.check_out > $2
  )
LIMIT 1
FOR UPDATE SKIP LOCKED
```

7. Insert header without `room_id`:

```sql
INSERT INTO room_bookings (
  member_id, check_in, check_out, guest_count, adults, children,
  special_request, promotion_id, status, total_price
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)
RETURNING *
```

Set initial `total_price` to 0 then update after lines, or compute first then insert.

8. Insert each `booking_room` with `price_per_night`, `nights`, `subtotal`, `status='pending'`.
9. Apply promotion to header total if `promotion_id` (reuse existing promo rules from current create path / promo controller).
10. `COMMIT`; async mail listing all room numbers; return header + rooms.

On shortfall: `ROLLBACK` + `409` with message including room type name.

- [ ] **Step 3: Typecheck**

```bash
cd backend && npm run build
```

Expected: success.

---

### Task 4: Read APIs return nested rooms

**Files:**
- Modify: `backend/src/controllers/booking.controller.ts` (`getUserRoomBookings`, `getRoomBookingById`, `getAllRoomBookings`)

**Interfaces:**
- Each booking object includes:

```ts
interface BookingRoomLineDto {
  booking_room_id: number;
  room_id: number;
  room_number: string;
  room_name: string;
  type_name: string | null;
  price_per_night: number;
  nights: number;
  subtotal: number;
  status: string;
  checkout_at: string | null;
}
```

- Header fields keep aliases used by frontend (`id`, `check_in_date`, `guests`, …) plus `adults`, `children`, `rooms: BookingRoomLineDto[]`.

- [ ] **Step 1: Replace joins**

Stop `JOIN rooms r ON rb.room_id = r.room_id`. Instead:

```sql
SELECT rb.*, ... ,
  COALESCE((
    SELECT json_agg(json_build_object(
      'booking_room_id', br.booking_room_id,
      'room_id', br.room_id,
      'room_number', r.room_number,
      'room_name', rt.room_name,
      'type_name', rt.type_name,
      'price_per_night', br.price_per_night,
      'nights', br.nights,
      'subtotal', br.subtotal,
      'status', br.status,
      'checkout_at', br.checkout_at
    ) ORDER BY br.booking_room_id)
    FROM booking_room br
    JOIN rooms r ON r.room_id = br.room_id
    JOIN room_types rt ON rt.id = r.room_type_id
    WHERE br.room_booking_id = rb.room_booking_id
  ), '[]'::json) AS rooms
FROM room_bookings rb
WHERE ...
```

For list cards, `room_name` display = first line or `"N ห้อง"`.

- [ ] **Step 2: Fix `getRoomBookingById` amenities** — derive `room_type_id` from first line’s room, or return amenities per line (prefer first type for minimal UI change).

- [ ] **Step 3: `npm run build` in backend**

---

### Task 5: Cancel, status sync, check-out by line

**Files:**
- Modify: `backend/src/controllers/booking.controller.ts`
- Modify: `backend/src/routes/booking.routes.ts`

**Interfaces:**
- `cancelRoomBooking(headerId)` → set header + all lines `cancelled`
- `updateRoomBookingStatus(headerId, status)` → set header + all lines (not already `checked_out`) to status; set `approved_by_staff_id` on approve/reject
- `checkoutBookingRoom(bookingRoomId)` → line `checked_out` + free room; **do not** set header to `checked_out`
- Deprecate/repurpose old `checkoutRoomBooking(:id)` that assumed header `room_id`: either redirect to “check out all approved lines” or remove and use new route only

- [ ] **Step 1: Add route**

```ts
router.put(
  '/booking-rooms/:bookingRoomId/checkout',
  authenticate,
  authorize('admin', 'room_staff'),
  checkoutBookingRoom
);
```

Place **before** `/:id` routes that could capture the path, or keep path under `/room/...` carefully. Prefer:

`PUT /api/bookings/booking-rooms/:bookingRoomId/checkout`

- [ ] **Step 2: Implement cancel/status SQL**

```sql
UPDATE room_bookings SET status = $1, updated_at = NOW() WHERE room_booking_id = $2;
UPDATE booking_room SET status = $1, updated_at = NOW()
WHERE room_booking_id = $2 AND status <> 'checked_out';
```

- [ ] **Step 3: Implement `checkoutBookingRoom`**

```sql
SELECT br.*, rb.status AS header_status
FROM booking_room br
JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
WHERE br.booking_room_id = $1;
-- require header_status = 'approved' and br.status = 'approved'
UPDATE booking_room SET status = 'checked_out', checkout_at = NOW() WHERE booking_room_id = $1;
UPDATE rooms SET status = 'available' WHERE room_id = $2;
```

- [ ] **Step 4: Mail on approve/reject** — include all room numbers from lines.

- [ ] **Step 5: backend build**

---

### Task 6: Payment slip syncs lines + availability SQL

**Files:**
- Modify: `backend/src/controllers/payment.controller.ts`
- Modify: `backend/src/controllers/room.controller.ts` (calendar + any `room_bookings.room_id` references)
- Grep and fix remaining `rb.room_id` / `room_bookings.room_id` in backend

**Interfaces:**
- Payment still keyed `room_{room_booking_id}` against header
- On slip success:

```sql
UPDATE room_bookings SET payment_slip=$1, payment_status='paid', status='paid' WHERE room_booking_id=$2 AND member_id=$3;
UPDATE booking_room SET status='paid' WHERE room_booking_id=$2;
```

- Calendar occupied count joins `booking_room` + header dates (same filter as create lock subquery).

- [ ] **Step 1: Update payment upload + reject-slip paths that touch room bookings**

- [ ] **Step 2: Update `getRoomCalendar` subquery** to count distinct `br.room_id` from `booking_room` joined to header

- [ ] **Step 3: Grep**

```bash
cd backend && rg "room_bookings.*room_id|rb\.room_id" src
```

Fix every hit (reviews eligible query, auto-cancel, settings stats if they join rooms via header `room_id`).

- [ ] **Step 4: backend build**

---

### Task 7: Frontend cart library + panel

**Files:**
- Create: `frontend/src/lib/room-cart.ts`
- Create: `frontend/src/components/booking/RoomCartPanel.tsx`

**Interfaces:**

```ts
export interface RoomCartItem {
  room_type_id: number;
  room_name: string;
  type_name: string | null;
  capacity: number;
  price_per_night: number;
  quantity: number;
  available_count: number;
}

export interface RoomCartState {
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  items: RoomCartItem[];
}

export function loadRoomCart(): RoomCartState | null;
export function saveRoomCart(state: RoomCartState): void;
export function clearRoomCart(): void;
export function upsertCartItem(state: RoomCartState, item: Omit<RoomCartItem, 'quantity'> & { quantity?: number }): RoomCartState;
export function cartCapacitySum(state: RoomCartState): number;
export function cartGuestTotal(state: RoomCartState): number;
export function cartEstimatedTotal(state: RoomCartState, nights: number): number;
```

Storage key: `walai_room_cart_v1`.

- [ ] **Step 1: Implement `room-cart.ts` with capacity helpers using same rules as backend**

- [ ] **Step 2: Build `RoomCartPanel`** — Thai labels: วันที่, รายการ, ผู้ใหญ่/เด็ก, ความจุ, ยอดประมาณ, ปุ่มล้าง / ยืนยันการจอง. Use project tokens (`forest`, `cream`, …). Call `onCheckout` prop.

- [ ] **Step 3: frontend lint/typecheck via `npm run build` when wired in Task 8**

---

### Task 8: Wire `/rooms` and `/rooms/[id]` to cart + multi create

**Files:**
- Modify: `frontend/src/app/rooms/page.tsx`
- Modify: `frontend/src/app/rooms/[id]/page.tsx`

**Interfaces:**
- List: quantity control + “เพิ่ม”; changing calendar range prompts if cart non-empty then `clearRoomCart` + update dates
- Detail: “เพิ่มเข้าการจอง” and “จองทันที” (if cart empty → POST shorthand; if cart has items → add current then checkout)
- Checkout POST:

```ts
await api.post('/bookings/room', {
  check_in_date: cart.check_in,
  check_out_date: cart.check_out,
  adults: cart.adults,
  children: cart.children,
  special_requests: specialRequests || undefined,
  promotion_id: appliedPromo?.id ?? undefined,
  items: cart.items.map((i) => ({
    room_type_id: i.room_type_id,
    quantity: i.quantity,
  })),
});
// router.push(`/payment?booking_type=room&booking_id=${res.data.data.room_booking_id}`)
clearRoomCart();
```

- Block checkout if `cartGuestTotal > cartCapacitySum` with toast.

- [ ] **Step 1: Integrate panel on both pages**

- [ ] **Step 2: Keep promo on detail checkout path** (apply once at checkout for whole cart)

- [ ] **Step 3: `cd frontend && npm run build`**

---

### Task 9: Customer history + admin dashboard

**Files:**
- Modify: `frontend/src/app/dashboard/bookings/page.tsx`
- Modify: `frontend/src/app/admin/rooms/dashboard/page.tsx`
- Modify staff room dashboard if separate under `frontend/src/app/staff/...`

**Interfaces:**
- History card shows date + total + list of `rooms[]`
- Admin: expand row → lines; approve/reject use header id (existing); check-out calls `PUT /bookings/booking-rooms/${booking_room_id}/checkout`
- Action column: status first, then slip (existing rule)

- [ ] **Step 1: Update types and rendering for nested `rooms`**

- [ ] **Step 2: Wire per-line check-out button when header `approved` and line `approved`**

- [ ] **Step 3: frontend build**

---

### Task 10: Docs + definition of done

**Files:**
- Modify: `AGENTS.md` (replace `booking_groups` note with `room_bookings` + `booking_room`)
- Modify: `README.md` main tables row for `booking_room` if listed

- [ ] **Step 1: Update domain docs**

- [ ] **Step 2: Manual test checklist**

1. Neon migration applied; old bookings show room via `rooms[]`
2. Single-room book → pay → approve → check-out line
3. Two types in cart → one payment → approve once → check-out each line
4. Guests > capacity → toast / 400
5. Calendar still blocks full days
6. `cd backend && npm run build` and `cd frontend && npm run build`

- [ ] **Step 3: Stop and ask user before commit/push**

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Header/detail ERD names | 2 |
| Multi-type one payment | 3, 6, 8 |
| Shared dates | 3, 7, 8 |
| Hybrid cart UX | 7, 8 |
| Group adults/children + capacity | 1, 3, 7 |
| Approve group / check-out line | 5, 9 |
| Migration backfill | 2 |
| Payment key unchanged | 6 |
| Out of scope left out | — |

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-09-multi-room-booking.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, batch with checkpoints  

Which approach?
