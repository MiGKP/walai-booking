# Promo applies-to (room vs kayak)

## Problem

Any promo code can be applied to room **or** kayak checkout. A room-sized percent/fixed discount can zero a cheaper kayak bill.

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Field | `promotions.applies_to` = `room` \| `kayak` \| `both` |
| Existing rows | Default **`both`** |
| Enforce | Apply math + validate + booking create (not UI-only) |
| Catalog | Show use-room / use-kayak buttons only when allowed |
| Zero baht | Still allowed when the code’s type matches the booking |

## Out of scope

- Per room-type targeting beyond existing `room_type_id`
- Floor price above ฿0
- Changing wallet/ledger tables

## API

- Create/update persist `applies_to` (default `both`).
- `POST /promotions/validate` body `scope`: `room` \| `kayak`.
- Room create uses `scope: 'room'`. Kayak create uses `scope: 'kayak'`.
- Mismatch → 400 Thai: `โค้ดนี้ใช้กับห้องพักเท่านั้น` / `โค้ดนี้ใช้กับเรือคายัคเท่านั้น`.
