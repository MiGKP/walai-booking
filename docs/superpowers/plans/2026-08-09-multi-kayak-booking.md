# Multi-Kayak Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow customers to book multiple kayak types in one checkout with one payment, shared date/time, and passenger→boat-count math.

**Architecture:** Evolve `boat_bookings` into a header (date, start/end time, payment, group status). Add `booking_boat` lines per boat type. Shared “round” = matching `start_time`/`end_time` across per-type `boat_rounds`. Frontend cart on `/kayaks` collects passengers per type.

**Tech Stack:** PostgreSQL/Neon, Express + TypeScript, Next.js, existing kayak payment flow.

**Spec:** `docs/superpowers/specs/2026-08-09-multi-kayak-booking-design.md`

## Global Constraints

- Header `boat_bookings` + lines `booking_boat` (singular name, mirror rooms).
- One date + one time window; passengers per type; `boat_count = ceil(passengers / seat_count)`.
- One payment / approve-reject whole group; v1 check-out whole group.
- `subtotal = unit_price * boat_count`; header total = sum(subtotals).
- Thai UI; explicit return types; no `any`; `{ success, message }` errors.
- Commit only when user asks.

---

### Task 1: Math helpers + tests

**Files:**
- Create: `backend/src/services/booking-boat.math.ts`
- Create: `backend/src/services/booking-boat.math.test.ts`
- Modify: `backend/package.json` (script)

**Interfaces:**
- `boatsNeeded(passengers: number, seatCount: number): number`
- `lineSubtotal(unitPrice: number, boatCount: number): number`
- `sumPassengerCounts(items: Array<{ num_passengers: number }>): number`

- [x] Tests for ceil boats (11 pax / 2 seats → 6), reject passengers < 1, seatCount < 1
- [x] Implement helpers
- [x] `npm run test:booking-boat-math`

---

### Task 2: Neon migration

**Files:**
- Create: `backend/src/db/migrations/2026-08-09-booking-boat.sql`

- [x] Create `booking_boat` table
- [x] Add `start_time`, `end_time` on `boat_bookings`; backfill from rounds
- [x] Backfill one line per legacy booking
- [x] Drop `boat_type_id`, `boat_round_id` from header after app ready (same migration if safe)
- [x] Apply to Neon via approved script / SQL editor

---

### Task 3: Create + validators + reads/status/payment

**Files:**
- Modify: validators, `kayak.controller.ts`, `payment.controller.ts`, availability SQL in kayak controller

- [x] Accept `items[]` + `start_time`/`end_time` or legacy shorthand
- [x] Resolve round per type; lock/check capacity using `boat_count`
- [x] Nested `boats` on list/detail; sync lines on pay/cancel/status/checkout
- [x] `npm run build` backend

---

### Task 4: Frontend kayaks cart + admin/staff display

**Files:**
- Modify: `frontend/src/app/kayaks/page.tsx`
- Create: `frontend/src/lib/kayak-cart.ts` (optional)
- Modify: `frontend/src/app/admin/boats/page.tsx`, dashboard bookings if needed
- Modify: `AGENTS.md` / README

- [x] Date → shared time slot → passengers per type → boat_count preview → one checkout
- [x] Admin expand lines
- [x] Frontend build

---

## Execution

Inline in this session (same as multi-room).
