# Member Promotions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collectible promo wallet and a per-booking redemption ledger so staff can audit who used which code, enforce per-member caps, optionally stack codes, and apply promos on kayak bookings too.

**Architecture:** Keep `promotions` as catalog. Add `member_promotions` (one row per member+code) and `booking_promotions` (one row per use on a room **or** kayak header). Pure apply math lives in `promotion-apply.ts`. SQL persist/restore lives in `promotion-ledger.ts`. Room create still writes `room_bookings.promotion_id` when exactly one code is applied; kayak never gets a header promo column.

**Tech Stack:** PostgreSQL, Express + TypeScript, Next.js App Router, Axios, existing JWT auth.

**Spec:** `docs/superpowers/specs/2026-09-06-member-promotions-design.md`

## Global Constraints

- PostgreSQL only. Do not run the teammate MySQL (`AUTO_INCREMENT`, `member(id)`, `room_bookings(id)`).
- INTEGER PKs: `members.member_id`, `promotions.id`, `room_bookings.room_booking_id`, `boat_bookings.boat_booking_id`.
- `is_collectible` and `stackable` default **false**. Existing type-code checkout must keep working.
- API errors `{ success: false, message: string }`. Thai `message`. No stack traces.
- Explicit return types on new functions. No `any`. Frontend uses `getApiErrorMessage`.
- Customer UI Thai. Code/commits English.
- Status CHECK on bookings unchanged. Promo wallet statuses only: `saved | used | expired`.
- Restore global `usage_count` + wallet only when header was `pending` or `paid` and becomes `cancelled` or `rejected`. Never restore after `approved`.
- Commit only when the user asks (checkbox commit steps are optional).
- Do not apply SQL to production Neon until the user says so.

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/services/promotion-apply.ts` | Parse ids, window/stack/cap rules, sequential discount math |
| `backend/src/services/promotion-apply.test.ts` | Unit tests for apply math |
| `backend/src/services/promotion-ledger.ts` | Load catalog/wallet/counts; insert ledger; restore on cancel/reject |
| `backend/src/db/migrations/2026-09-06-member-promotions.sql` | ALTER `promotions` + create wallet/ledger |
| `backend/src/middleware/auth.middleware.ts` | `optionalAuthenticate` for validate |
| `backend/src/middleware/validators.ts` | New promo fields, `promotion_ids`, collect param |
| `backend/src/controllers/promotion.controller.ts` | Collect / uncollect / mine / redemptions / validate / CRUD columns |
| `backend/src/routes/promotion.routes.ts` | New routes; `/mine` before `/:id/...` |
| `backend/src/controllers/booking.controller.ts` | Apply list on create; restore on cancel/reject |
| `backend/src/controllers/kayak.controller.ts` | Same for kayak create/cancel/reject |
| `backend/package.json` | `test:promotion-apply` script |
| `frontend/src/components/booking/PromoCodeFields.tsx` | Shared code input + collect + stack |
| `frontend/src/components/booking/PromoPriceBreakdown.tsx` | Multi-line discount display |
| `frontend/src/components/booking/RoomCartPanel.tsx` | Use shared fields; send `promotion_ids` |
| `frontend/src/app/rooms/page.tsx` | Pass `promotion_ids` into create body |
| `frontend/src/app/kayaks/page.tsx` | Promo UI + create body |
| `frontend/src/app/admin/promotions/page.tsx` | New fields + redemptions panel |
| `frontend/src/app/dashboard/bookings/page.tsx` | **โค้ดของฉัน** from `GET /promotions/mine` |
| `AGENTS.md` | Domain note for wallet vs ledger |

---

### Task 1: Pure apply helpers + tests

**Files:**
- Create: `backend/src/services/promotion-apply.ts`
- Create: `backend/src/services/promotion-apply.test.ts`
- Modify: `backend/package.json` (add script `test:promotion-apply`)

**Interfaces:**
- Produces: `PromoApplyError` (Thai `message`)
- Produces: `parsePromotionIds(body: Record<string, unknown>): number[]`
- Produces: `isPromoInWindow(promo: CatalogPromo, now: Date): boolean`
- Produces: `singleDiscount(promo: CatalogPromo, remaining: number, nights: number | null): { discountAmount: number; nextTotal: number }`
- Produces: `headerPromotionId(ids: number[]): number | null`
- Produces: `shouldRestoreQuota(previousStatus: string): boolean`
- Produces: `walletStatusAfterUse(limit: number | null, usedAfter: number): 'saved' | 'used'`
- Produces: `applyPromotionList(promosInOrder: CatalogPromo[], ctx: ApplyContext): ApplyResult`

`CatalogPromo`, `ApplyContext`, `ApplyResult` defined in `promotion-apply.ts` as `interface` (not `type`).

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PromoApplyError,
  applyPromotionList,
  headerPromotionId,
  parsePromotionIds,
  shouldRestoreQuota,
  singleDiscount,
  walletStatusAfterUse,
  type CatalogPromo,
} from './promotion-apply';

function promo(partial: Partial<CatalogPromo> & Pick<CatalogPromo, 'id'>): CatalogPromo {
  return {
    code: 'X',
    name: 'X',
    discount_type: 'percent',
    discount_value: 10,
    min_nights: null,
    min_price: null,
    max_discount: null,
    usage_limit: null,
    usage_count: 0,
    is_active: true,
    start_date: null,
    end_date: null,
    usage_limit_per_member: null,
    is_collectible: false,
    stackable: false,
    ...partial,
  };
}

describe('parsePromotionIds', () => {
  it('prefers promotion_ids array over singular promotion_id', (): void => {
    assert.deepEqual(
      parsePromotionIds({ promotion_ids: [2, 3], promotion_id: 9 }),
      [2, 3]
    );
  });

  it('falls back to singular promotion_id', (): void => {
    assert.deepEqual(parsePromotionIds({ promotion_id: 4 }), [4]);
  });

  it('returns empty when neither is set', (): void => {
    assert.deepEqual(parsePromotionIds({}), []);
  });
});

describe('singleDiscount', () => {
  it('applies percent then caps at max_discount', (): void => {
    const { discountAmount, nextTotal } = singleDiscount(
      promo({ id: 1, discount_type: 'percent', discount_value: 50, max_discount: 100 }),
      1000,
      2
    );
    assert.equal(discountAmount, 100);
    assert.equal(nextTotal, 900);
  });

  it('skips min_nights when nights is null (kayak)', (): void => {
    const { nextTotal } = singleDiscount(
      promo({ id: 1, min_nights: 3, discount_type: 'fixed', discount_value: 50 }),
      200,
      null
    );
    assert.equal(nextTotal, 150);
  });

  it('throws when room nights below min_nights', (): void => {
    assert.throws(
      () =>
        singleDiscount(
          promo({ id: 1, min_nights: 3, discount_type: 'fixed', discount_value: 10 }),
          500,
          1
        ),
      PromoApplyError
    );
  });
});

describe('applyPromotionList', () => {
  const now = new Date('2026-09-06T00:00:00Z');

  it('rejects a second non-stackable code', (): void => {
    assert.throws(
      () =>
        applyPromotionList(
          [promo({ id: 1, stackable: false }), promo({ id: 2, stackable: true })],
          {
            memberId: 1,
            nights: 2,
            basePrice: 1000,
            now,
            memberUsedCountByPromoId: {},
            walletsByPromoId: {},
          }
        ),
      (err: unknown) =>
        err instanceof PromoApplyError &&
        err.message === 'โค้ดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้'
    );
  });

  it('applies stackable codes on remaining total in order', (): void => {
    const result = applyPromotionList(
      [
        promo({
          id: 1,
          stackable: true,
          discount_type: 'percent',
          discount_value: 10,
        }),
        promo({
          id: 2,
          stackable: true,
          discount_type: 'fixed',
          discount_value: 50,
        }),
      ],
      {
        memberId: 1,
        nights: 2,
        basePrice: 1000,
        now,
        memberUsedCountByPromoId: {},
        walletsByPromoId: {},
      }
    );
    assert.equal(result.lines[0].discount_amount, 100);
    assert.equal(result.lines[1].discount_amount, 50);
    assert.equal(result.totalPrice, 850);
    assert.equal(result.headerPromotionId, null);
  });

  it('requires a saved wallet row when collectible', (): void => {
    assert.throws(
      () =>
        applyPromotionList(
          [promo({ id: 1, is_collectible: true })],
          {
            memberId: 1,
            nights: 1,
            basePrice: 500,
            now,
            memberUsedCountByPromoId: {},
            walletsByPromoId: {},
          }
        ),
      (err: unknown) =>
        err instanceof PromoApplyError &&
        err.message === 'ต้องเก็บโค้ดนี้ก่อนใช้'
    );
  });

  it('rejects when per-member cap is already reached', (): void => {
    assert.throws(
      () =>
        applyPromotionList(
          [promo({ id: 1, usage_limit_per_member: 1 })],
          {
            memberId: 1,
            nights: 1,
            basePrice: 500,
            now,
            memberUsedCountByPromoId: { 1: 1 },
            walletsByPromoId: {},
          }
        ),
      (err: unknown) =>
        err instanceof PromoApplyError &&
        err.message === 'ใช้โค้ดนี้ครบจำนวนครั้งแล้ว'
    );
  });
});

describe('headerPromotionId', () => {
  it('returns the sole id and null when stacked', (): void => {
    assert.equal(headerPromotionId([7]), 7);
    assert.equal(headerPromotionId([7, 8]), null);
    assert.equal(headerPromotionId([]), null);
  });
});

describe('shouldRestoreQuota', () => {
  it('restores only pending or paid', (): void => {
    assert.equal(shouldRestoreQuota('pending'), true);
    assert.equal(shouldRestoreQuota('paid'), true);
    assert.equal(shouldRestoreQuota('approved'), false);
  });
});

describe('walletStatusAfterUse', () => {
  it('stays saved when per-member cap is unlimited', (): void => {
    assert.equal(walletStatusAfterUse(null, 5), 'saved');
  });

  it('becomes used when count reaches the cap', (): void => {
    assert.equal(walletStatusAfterUse(2, 2), 'used');
    assert.equal(walletStatusAfterUse(2, 1), 'saved');
  });
});
```

- [ ] **Step 2: Run tests (expect fail)**

```bash
cd backend
npx --no-install node --test -r ts-node/register src/services/promotion-apply.test.ts
```

Expected: module not found / cannot find `./promotion-apply`.

- [ ] **Step 3: Implement `promotion-apply.ts`**

```ts
export class PromoApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoApplyError';
  }
}

export interface CatalogPromo {
  id: number;
  code: string;
  name: string;
  discount_type: 'percent' | 'fixed';
  usage_limit: number | null;
  usage_count: number;
  discount_value: number;
  min_nights: number | null;
  min_price: number | null;
  max_discount: number | null;
  is_active: boolean;
  start_date: string | Date | null;
  end_date: string | Date | null;
  usage_limit_per_member: number | null;
  is_collectible: boolean;
  stackable: boolean;
}

export interface WalletState {
  member_promotion_id: number;
  status: 'saved' | 'used' | 'expired';
}

export interface ApplyContext {
  memberId: number;
  nights: number | null;
  basePrice: number;
  now: Date;
  memberUsedCountByPromoId: Record<number, number>;
  walletsByPromoId: Record<number, WalletState | undefined>;
}

export interface ApplyLine {
  promotion_id: number;
  member_promotion_id: number | null;
  discount_amount: number;
}

export interface ApplyResult {
  totalPrice: number;
  lines: ApplyLine[];
  headerPromotionId: number | null;
}

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function parsePromotionIds(body: Record<string, unknown>): number[] {
  if (Array.isArray(body.promotion_ids)) {
    const ids: number[] = [];
    for (const raw of body.promotion_ids) {
      const id = toPositiveInt(raw);
      if (id != null) ids.push(id);
    }
    return ids;
  }
  const one = toPositiveInt(body.promotion_id);
  return one != null ? [one] : [];
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isPromoInWindow(promo: CatalogPromo, now: Date): boolean {
  if (!promo.is_active) return false;
  const day = startOfDay(now);
  if (promo.start_date != null && new Date(promo.start_date) > day) return false;
  if (promo.end_date != null && new Date(promo.end_date) < day) return false;
  if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) return false;
  return true;
}

export function headerPromotionId(ids: number[]): number | null {
  if (ids.length === 1) return ids[0];
  return null;
}

export function shouldRestoreQuota(previousStatus: string): boolean {
  return previousStatus === 'pending' || previousStatus === 'paid';
}

export function walletStatusAfterUse(
  limit: number | null,
  usedAfter: number
): 'saved' | 'used' {
  if (limit == null) return 'saved';
  return usedAfter >= limit ? 'used' : 'saved';
}

export function singleDiscount(
  promo: CatalogPromo,
  remaining: number,
  nights: number | null
): { discountAmount: number; nextTotal: number } {
  if (nights != null && promo.min_nights != null && nights < Number(promo.min_nights)) {
    throw new PromoApplyError(`โปรโมชั่นนี้ต้องจองขั้นต่ำ ${promo.min_nights} คืน`);
  }
  if (promo.min_price != null && remaining < Number(promo.min_price)) {
    throw new PromoApplyError(
      `โปรโมชั่นนี้ต้องมียอดขั้นต่ำ ฿${Number(promo.min_price).toLocaleString()}`
    );
  }
  let discountAmount = 0;
  if (promo.discount_type === 'percent') {
    discountAmount = (remaining * Number(promo.discount_value)) / 100;
    if (promo.max_discount != null) {
      discountAmount = Math.min(discountAmount, Number(promo.max_discount));
    }
  } else {
    discountAmount = Math.min(Number(promo.discount_value), remaining);
  }
  discountAmount = Math.round(discountAmount);
  const nextTotal = Math.max(0, remaining - discountAmount);
  return { discountAmount, nextTotal };
}

export function applyPromotionList(
  promosInOrder: CatalogPromo[],
  ctx: ApplyContext
): ApplyResult {
  const ids = promosInOrder.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new PromoApplyError('ไม่สามารถใช้โค้ดซ้ำในบิลเดียวกันได้');
  }
  if (promosInOrder.length > 1) {
    const allStackable = promosInOrder.every((p) => p.stackable);
    if (!allStackable) {
      throw new PromoApplyError('โค้ดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้');
    }
  }

  let remaining = ctx.basePrice;
  const lines: ApplyLine[] = [];

  for (const promo of promosInOrder) {
    if (!isPromoInWindow(promo, ctx.now)) {
      throw new PromoApplyError('โปรโมชั่นหมดอายุแล้ว');
    }
    if (promo.is_collectible) {
      const wallet = ctx.walletsByPromoId[promo.id];
      if (wallet == null || wallet.status !== 'saved') {
        throw new PromoApplyError('ต้องเก็บโค้ดนี้ก่อนใช้');
      }
    }
    const used = ctx.memberUsedCountByPromoId[promo.id] ?? 0;
    if (
      promo.usage_limit_per_member != null &&
      used >= promo.usage_limit_per_member
    ) {
      throw new PromoApplyError('ใช้โค้ดนี้ครบจำนวนครั้งแล้ว');
    }
    const { discountAmount, nextTotal } = singleDiscount(
      promo,
      remaining,
      ctx.nights
    );
    remaining = nextTotal;
    const wallet = ctx.walletsByPromoId[promo.id];
    lines.push({
      promotion_id: promo.id,
      member_promotion_id: promo.is_collectible
        ? (wallet?.member_promotion_id ?? null)
        : null,
      discount_amount: discountAmount,
    });
  }

  return {
    totalPrice: remaining,
    lines,
    headerPromotionId: headerPromotionId(ids),
  };
}
```

- [ ] **Step 4: Add npm script and re-run tests**

In `backend/package.json` scripts:

```json
"test:promotion-apply": "node --test -r ts-node/register src/services/promotion-apply.test.ts"
```

```bash
cd backend
npm run test:promotion-apply
```

Expected: all tests pass.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add backend/src/services/promotion-apply.ts backend/src/services/promotion-apply.test.ts backend/package.json
git commit -m "feat: add promotion apply math for wallet and stacked codes"
```

---

### Task 2: Postgres migration

**Files:**
- Create: `backend/src/db/migrations/2026-09-06-member-promotions.sql`

**Interfaces:**
- Consumes: spec schema
- Produces: `promotions.usage_limit_per_member`, `is_collectible`, `stackable`; tables `member_promotions`, `booking_promotions`

- [ ] **Step 1: Write migration SQL**

```sql
ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS usage_limit_per_member INTEGER NULL,
  ADD COLUMN IF NOT EXISTS is_collectible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stackable BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_usage_limit_per_member_check'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_usage_limit_per_member_check
      CHECK (usage_limit_per_member IS NULL OR usage_limit_per_member >= 1);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS member_promotions (
  member_promotion_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'used', 'expired')),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ NULL,
  UNIQUE (member_id, promotion_id)
);

CREATE INDEX IF NOT EXISTS idx_member_promotions_member_status
  ON member_promotions (member_id, status);
CREATE INDEX IF NOT EXISTS idx_member_promotions_promotion
  ON member_promotions (promotion_id);

CREATE TABLE IF NOT EXISTS booking_promotions (
  booking_promotion_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  promotion_id INTEGER NOT NULL REFERENCES promotions(id),
  member_id INTEGER NOT NULL REFERENCES members(member_id),
  member_promotion_id INTEGER NULL REFERENCES member_promotions(member_promotion_id),
  room_booking_id INTEGER NULL REFERENCES room_bookings(room_booking_id) ON DELETE CASCADE,
  boat_booking_id INTEGER NULL REFERENCES boat_bookings(boat_booking_id) ON DELETE CASCADE,
  discount_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_promotions_one_header_check
    CHECK ((room_booking_id IS NOT NULL) <> (boat_booking_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_promotions_room_promo_unique
  ON booking_promotions (room_booking_id, promotion_id)
  WHERE room_booking_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS booking_promotions_boat_promo_unique
  ON booking_promotions (boat_booking_id, promotion_id)
  WHERE boat_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_promotions_promotion ON booking_promotions (promotion_id);
CREATE INDEX IF NOT EXISTS idx_booking_promotions_member ON booking_promotions (member_id);
CREATE INDEX IF NOT EXISTS idx_booking_promotions_room ON booking_promotions (room_booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_promotions_boat ON booking_promotions (boat_booking_id);
```

- [ ] **Step 2: Apply on local Postgres** (backend `.env` `DATABASE_URL`)

```bash
cd backend
npx --no-install ts-node -e "const fs=require('fs'); const {Pool}=require('pg'); require('dotenv').config(); (async()=>{ const sql=fs.readFileSync('src/db/migrations/2026-09-06-member-promotions.sql','utf8'); const pool=new Pool({connectionString:process.env.DATABASE_URL}); await pool.query(sql); console.log('ok'); await pool.end(); })().catch(e=>{ console.error(e); process.exit(1); });"
```

Expected: `ok`. If `Pool.query` rejects multi-statement, split into sequential statements in a small `backend/src/db/apply-member-promotions.ts` that runs each statement, or use `psql -f`.

Do **not** run on Neon production in this task.

- [ ] **Step 3: Commit (only if user asked)**

```bash
git add backend/src/db/migrations/2026-09-06-member-promotions.sql
git commit -m "feat: add member_promotions wallet and booking_promotions ledger"
```

---

### Task 3: Ledger persist / restore

**Files:**
- Create: `backend/src/services/promotion-ledger.ts`

**Interfaces:**
- Consumes: `applyPromotionList`, `ApplyResult`, `shouldRestoreQuota`, `walletStatusAfterUse` from `./promotion-apply`
- Produces: `loadPromosForApply(client, ids: number[]): Promise<CatalogPromo[]>`
- Produces: `loadApplyContext(client, memberId: number, promoIds: number[]): Promise<Pick<ApplyContext, 'memberUsedCountByPromoId' | 'walletsByPromoId'>>`
- Produces: `persistBookingPromotions(client, args): Promise<void>`
- Produces: `restoreBookingPromotions(client, args): Promise<void>`

Query client shape: `{ query: typeof pool.query }` (same as current `applyPromotionDiscount`).

- [ ] **Step 1: Implement `promotion-ledger.ts`**

```ts
import {
  CatalogPromo,
  ApplyContext,
  ApplyResult,
  shouldRestoreQuota,
  walletStatusAfterUse,
} from './promotion-apply';
import { Pool } from 'pg';

type QueryClient = { query: Pool['query'] };

export async function loadPromosForApply(
  client: QueryClient,
  ids: number[]
): Promise<CatalogPromo[]> {
  if (ids.length === 0) return [];
  const res = await client.query(
    `SELECT id, code, name, discount_type, discount_value,
            min_nights, min_price, max_discount, usage_limit, usage_count,
            is_active, start_date, end_date,
            usage_limit_per_member, is_collectible, stackable
     FROM promotions WHERE id = ANY($1::int[])`,
    [ids]
  );
  const byId = new Map(res.rows.map((row) => [Number(row.id), row as CatalogPromo]));
  const ordered: CatalogPromo[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      throw new Error('โปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว');
    }
    ordered.push(row);
  }
  return ordered;
}

export async function loadApplyContext(
  client: QueryClient,
  memberId: number,
  promoIds: number[]
): Promise<Pick<ApplyContext, 'memberUsedCountByPromoId' | 'walletsByPromoId'>> {
  const memberUsedCountByPromoId: Record<number, number> = {};
  const walletsByPromoId: ApplyContext['walletsByPromoId'] = {};
  if (promoIds.length === 0) {
    return { memberUsedCountByPromoId, walletsByPromoId };
  }
  const used = await client.query(
    `SELECT promotion_id, COUNT(*)::int AS n
     FROM booking_promotions
     WHERE member_id = $1 AND promotion_id = ANY($2::int[])
     GROUP BY promotion_id`,
    [memberId, promoIds]
  );
  for (const row of used.rows) {
    memberUsedCountByPromoId[Number(row.promotion_id)] = Number(row.n);
  }
  const wallets = await client.query(
    `SELECT member_promotion_id, promotion_id, status
     FROM member_promotions
     WHERE member_id = $1 AND promotion_id = ANY($2::int[])`,
    [memberId, promoIds]
  );
  for (const row of wallets.rows) {
    walletsByPromoId[Number(row.promotion_id)] = {
      member_promotion_id: Number(row.member_promotion_id),
      status: row.status,
    };
  }
  return { memberUsedCountByPromoId, walletsByPromoId };
}

export async function persistBookingPromotions(
  client: QueryClient,
  args: {
    memberId: number;
    roomBookingId?: number;
    boatBookingId?: number;
    result: ApplyResult;
  }
): Promise<void> {
  for (const line of args.result.lines) {
    await client.query(
      `INSERT INTO booking_promotions (
         promotion_id, member_id, member_promotion_id,
         room_booking_id, boat_booking_id, discount_amount
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        line.promotion_id,
        args.memberId,
        line.member_promotion_id,
        args.roomBookingId ?? null,
        args.boatBookingId ?? null,
        line.discount_amount,
      ]
    );
    await client.query(
      `UPDATE promotions SET usage_count = usage_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [line.promotion_id]
    );
    if (line.member_promotion_id != null) {
      const cap = await client.query(
        `SELECT p.usage_limit_per_member,
                (SELECT COUNT(*)::int FROM booking_promotions bp
                 WHERE bp.member_id = $1 AND bp.promotion_id = $2) AS used
         FROM promotions p WHERE p.id = $2`,
        [args.memberId, line.promotion_id]
      );
      const used = Number(cap.rows[0].used);
      const limit =
        cap.rows[0].usage_limit_per_member == null
          ? null
          : Number(cap.rows[0].usage_limit_per_member);
      const next = walletStatusAfterUse(limit, used);
      await client.query(
        `UPDATE member_promotions
         SET status = $1, used_at = CASE WHEN $1 = 'used' THEN NOW() ELSE NULL END
         WHERE member_promotion_id = $2`,
        [next, line.member_promotion_id]
      );
    }
  }
}

export async function restoreBookingPromotions(
  client: QueryClient,
  args: {
    previousStatus: string;
    roomBookingId?: number;
    boatBookingId?: number;
  }
): Promise<void> {
  if (!shouldRestoreQuota(args.previousStatus)) return;
  const rows = await client.query(
    `DELETE FROM booking_promotions
     WHERE ($1::int IS NOT NULL AND room_booking_id = $1)
        OR ($2::int IS NOT NULL AND boat_booking_id = $2)
     RETURNING promotion_id, member_id, member_promotion_id`,
    [args.roomBookingId ?? null, args.boatBookingId ?? null]
  );
  for (const row of rows.rows) {
    await client.query(
      `UPDATE promotions
       SET usage_count = GREATEST(usage_count - 1, 0), updated_at = NOW()
       WHERE id = $1`,
      [row.promotion_id]
    );
    if (row.member_promotion_id != null) {
      const cap = await client.query(
        `SELECT p.usage_limit_per_member,
                (SELECT COUNT(*)::int FROM booking_promotions bp
                 WHERE bp.member_id = $1 AND bp.promotion_id = $2) AS used
         FROM promotions p WHERE p.id = $2`,
        [row.member_id, row.promotion_id]
      );
      const used = Number(cap.rows[0].used);
      const limit =
        cap.rows[0].usage_limit_per_member == null
          ? null
          : Number(cap.rows[0].usage_limit_per_member);
      const next = walletStatusAfterUse(limit, used);
      await client.query(
        `UPDATE member_promotions
         SET status = $1, used_at = CASE WHEN $1 = 'used' THEN NOW() ELSE NULL END
         WHERE member_promotion_id = $2`,
        [next, row.member_promotion_id]
      );
    }
  }
}
```

- [ ] **Step 2: `cd backend && npm run build`**

Expected: `tsc` exit 0.

---

### Task 4: Wallet API (collect / mine / redemptions)

**Files:**
- Modify: `backend/src/middleware/validators.ts`
- Modify: `backend/src/controllers/promotion.controller.ts`
- Modify: `backend/src/routes/promotion.routes.ts`

**Interfaces:**
- Consumes: tables from Task 2
- Produces HTTP:
  - `POST /api/promotions/:id/collect` customer
  - `DELETE /api/promotions/:id/collect` customer
  - `GET /api/promotions/mine` customer
  - `GET /api/promotions/:id/redemptions` admin + room_staff

- [ ] **Step 1: Validators**

Add:

```ts
export const promotionIdParamValidator = [
  param('id').isInt({ min: 1 }).withMessage('Valid promotion id is required'),
];
```

- [ ] **Step 2: Controller handlers**

`collectPromotion`: `authenticate` then if `user.role !== 'customer'` → 403. Load promo. If `!is_collectible` → 409 `โปรโมชั่นนี้ไม่ต้องเก็บโค้ด`. If inactive or outside dates → 409 `โปรโมชั่นหมดอายุแล้ว`. `INSERT ... ON CONFLICT (member_id, promotion_id) DO NOTHING RETURNING *`. If conflict row exists with `used` → 409 `ใช้โค้ดนี้ครบจำนวนครั้งแล้ว`. If `expired` → 409. If `saved` → 200 idempotent with existing row.

`uncollectPromotion`: 400 if any `booking_promotions` for that pair. Else `DELETE` wallet row.

`getMyPromotions`: join `member_promotions` + `promotions`. Compute `used_count` subquery and `remaining` (`null` if unlimited). If catalog `end_date` passed or `!is_active`, expose `status: 'expired'` in JSON even if DB still `saved`.

`getPromotionRedemptions`: ledger rows with member name/email, `booking_type` `room`|`kayak`, header `status`, plus `{ wallet: { saved, used, expired } }` counts.

Use `AuthRequest` / `AuthPayload` like other controllers. `{ success: true, data }`.

- [ ] **Step 3: Routes — register `/mine` before `/:id/...`**

```ts
router.get('/mine', authenticate, getMyPromotions);
router.get('/:id/redemptions', authenticate, authorize('admin', 'room_staff'), promotionIdParamValidator, validate, getPromotionRedemptions);
router.post('/:id/collect', authenticate, promotionIdParamValidator, validate, collectPromotion);
router.delete('/:id/collect', authenticate, promotionIdParamValidator, validate, uncollectPromotion);
```

- [ ] **Step 4: `cd backend && npm run build`**

---

### Task 5: Validate + admin CRUD columns

**Files:**
- Modify: `backend/src/middleware/auth.middleware.ts`
- Modify: `backend/src/middleware/validators.ts`
- Modify: `backend/src/controllers/promotion.controller.ts`
- Modify: `backend/src/routes/promotion.routes.ts`

**Interfaces:**
- Produces: `optionalAuthenticate`
- Validate body may include `promotion_ids: number[]` and/or `code`
- Create/update persist `usage_limit_per_member`, `is_collectible`, `stackable`

- [ ] **Step 1: `optionalAuthenticate`**

If no `Authorization` header → `next()`. If Bearer present, verify JWT like `authenticate`; invalid token → 401. Attach `req.user` on success.

- [ ] **Step 2: Extend `validatePromoCodeValidator`**

Keep `code` required **unless** `promotion_ids` is a non-empty array:

```ts
body().custom((_, { req }) => {
  const hasCode = typeof req.body.code === 'string' && req.body.code.trim().length > 0;
  const hasIds = Array.isArray(req.body.promotion_ids) && req.body.promotion_ids.length > 0;
  if (!hasCode && !hasIds) throw new Error('Promotion code is required');
  return true;
});
body('code').optional({ checkFalsy: true }).trim();
body('promotion_ids').optional().isArray();
body('promotion_ids.*').optional().isInt({ min: 1 });
```

Remove the old hard `code` `notEmpty` or the custom will fight it — drop `notEmpty` on `code`.

Add to create/update validators:

```ts
body('usage_limit_per_member').optional({ nullable: true }).isInt({ min: 1 }),
body('is_collectible').optional().isBoolean(),
body('stackable').optional().isBoolean(),
```

- [ ] **Step 3: `validatePromoCode`**

If `promotion_ids` present, load those ids. Else resolve `code` as today (`UPPER(code)`). If `req.user` is a customer, call `loadApplyContext` + `applyPromotionList` with `price` / `nights` (`nights` missing → `null`). Return:

```ts
{
  id: first.id, // keep old field for one-code UI
  code, name, description, discount_type, discount_value,
  discount_amount: base - result.totalPrice,
  final_price: result.totalPrice,
  lines: result.lines.map(... plus code/name),
  is_collectible, stackable,
}
```

Map `PromoApplyError` → 400 `{ success: false, message }`.

`getActivePromotions` / `getAllPromotions` SELECT add the three new columns.

`createPromotion` / `updatePromotion` INSERT/UPDATE those columns. Defaults: collectible/stackable false, per-member null.

- [ ] **Step 4: Route validate through `optionalAuthenticate`**

```ts
router.post('/validate', optionalAuthenticate, validatePromoCodeValidator, validate, validatePromoCode);
```

- [ ] **Step 5: `cd backend && npm run build` && `npm run test:promotion-apply`**

---

### Task 6: Room booking create + cancel/reject restore

**Files:**
- Modify: `backend/src/middleware/validators.ts` (`createRoomBookingValidator`)
- Modify: `backend/src/controllers/booking.controller.ts`

**Interfaces:**
- Consumes: `parsePromotionIds`, `applyPromotionList`, `PromoApplyError`, ledger helpers
- Replace local `applyPromotionDiscount` with the shared list helper (delete the old function once unused)

- [ ] **Step 1: Validator**

```ts
body('promotion_ids').optional().isArray(),
body('promotion_ids.*').optional().isInt({ min: 1 }),
```

Keep existing `promotion_id`.

- [ ] **Step 2: Create path**

After computing `totalPrice` from subtotals:

```ts
const promoIds = parsePromotionIds(body);
let applyResult = { totalPrice, lines: [], headerPromotionId: null as number | null };
if (promoIds.length > 0) {
  const catalog = await loadPromosForApply(client, promoIds);
  const ctxExtra = await loadApplyContext(client, user.id, promoIds);
  applyResult = applyPromotionList(catalog, {
    memberId: user.id,
    nights,
    basePrice: totalPrice,
    now: new Date(),
    ...ctxExtra,
  });
  totalPrice = applyResult.totalPrice;
}
```

INSERT header `promotion_id` = `applyResult.headerPromotionId`. After lines insert, `persistBookingPromotions({ memberId: user.id, roomBookingId, result: applyResult })`. Catch `PromoApplyError` → rollback 400. Remove the old `usage_count + 1` block (ledger does it).

- [ ] **Step 3: `cancelRoomBooking`**

Use a transaction (`pool.connect` + `BEGIN`). `SELECT status ... FOR UPDATE`. If `pending`, `restoreBookingPromotions({ previousStatus, roomBookingId })` then set cancelled (header + lines) as today.

- [ ] **Step 4: `updateRoomBookingStatus`**

Before UPDATE, `SELECT status FROM room_bookings WHERE room_booking_id = $1 FOR UPDATE`. If incoming status is `rejected` or `cancelled`, call `restoreBookingPromotions` with **previous** status. Then existing UPDATE + sync lines.

- [ ] **Step 5: `cd backend && npm run build`**

---

### Task 7: Kayak booking create + cancel/reject restore

**Files:**
- Modify: `backend/src/middleware/validators.ts` (`createKayakBookingValidator`)
- Modify: `backend/src/controllers/kayak.controller.ts`

**Interfaces:** same ledger helpers. `nights: null`. Persist with `boatBookingId`. No `boat_bookings.promotion_id` column.

- [ ] **Step 1: Add `promotion_id` / `promotion_ids` validators** (same as rooms).

- [ ] **Step 2: After `const totalPrice = sumSubtotals(...)` and before INSERT header**, apply promo list; INSERT header with discounted `totalPrice`; after lines, `persistBookingPromotions({ boatBookingId: header.boat_booking_id, ... })`.

- [ ] **Step 3: `cancelKayakBooking`** — already transactional. After pending check, `restoreBookingPromotions({ previousStatus: 'pending', boatBookingId: Number(id) })` then existing updates.

- [ ] **Step 4: `updateKayakBookingStatus`** — `SELECT status ... FOR UPDATE` first. If new status is `rejected` or `cancelled` (if you add cancelled to allowed; today allowed is approved/rejected/pending/checked_out — **restore on `rejected` only** unless cancelled is added). Spec: cancel **or** reject. Customer cancel is Task 7 step 3. Staff reject: restore when previous was pending or paid.

- [ ] **Step 5: `cd backend && npm run build`**

---

### Task 8: Admin promotions UI (เช็คโปรโมชั่น)

**Files:**
- Modify: `frontend/src/app/admin/promotions/page.tsx`

**Interfaces:**
- Consumes: `GET /promotions`, `GET /promotions/:id/redemptions`, create/update body new fields

- [ ] **Step 1: Types + form defaults**

Add to `Promotion` and `defaultForm`:

```ts
usage_limit_per_member?: number | null;
is_collectible: boolean;
stackable: boolean;
```

Form strings/booleans: `usage_limit_per_member: ""`, `is_collectible: false`, `stackable: false`.

- [ ] **Step 2: Payload on create/update**

```ts
usage_limit_per_member: form.usage_limit_per_member ? Number(form.usage_limit_per_member) : null,
is_collectible: form.is_collectible,
stackable: form.stackable,
```

- [ ] **Step 3: Form fields** (Thai labels next to existing usage_limit grid)

- จำกัดต่อสมาชิก (ครั้ง) — number, placeholder ไม่จำกัด
- ต้องเก็บโค้ดก่อนใช้ — checkbox
- ใช้ร่วมโค้ดอื่นได้ — checkbox

- [ ] **Step 4: Redemptions panel**

When a row is expanded or “ดูผู้ใช้” clicked, `GET /promotions/${id}/redemptions`. Show wallet counts + table: member email, booking type, booking id, header status, discount, date. Empty: `ยังไม่มีคนใช้โค้ดนี้`.

Use `getApiErrorMessage`. Keep forest/cream/stone patterns already on this page.

---

### Task 9: Shared customer promo fields + room cart

**Files:**
- Create: `frontend/src/components/booking/PromoCodeFields.tsx`
- Modify: `frontend/src/components/booking/PromoPriceBreakdown.tsx`
- Modify: `frontend/src/components/booking/RoomCartPanel.tsx`
- Modify: `frontend/src/app/rooms/page.tsx`

**Interfaces:**
- `PromoCodeFields` props: `basePrice: number; nights: number | null; onChange: (ids: number[], preview: PromoPreview | null) => void`
- `PromoPreview`: `{ discount_amount: number; final_price: number; lines: Array<{ id: number; code: string; name: string; discount_amount: number }>; nextNeedsCollect?: { id: number; code: string } }`
- Checkout: `promotion_ids?: number[]` (legacy `promotion_id` only if length === 1 still OK; prefer array)

- [ ] **Step 1: Extend `PromoPriceBreakdown`**

Accept optional `lines?: Array<{ code: string; discount_amount: number }>`. If `lines` length > 1, list each code’s discount and one total. If absent, keep current single `promo` behavior.

- [ ] **Step 2: `PromoCodeFields`**

State: input string, applied lines[], loading, collectTarget.

`POST /promotions/validate` with `{ code, price: basePrice, nights }` or `{ promotion_ids: [...existing, newId], price, nights }`.

If error message is `ต้องเก็บโค้ดนี้ก่อนใช้`, set collectTarget and show button **เก็บโค้ด** → `POST /promotions/${id}/collect` → re-validate.

If last applied promo `stackable` (from validate payload), keep input visible to add another code. Else one code as today.

Remove last code with X.

- [ ] **Step 3: Room cart**

Replace inline promo UI with `PromoCodeFields`. `onCheckout({ promotion_ids })` when ids length > 0.

- [ ] **Step 4: `rooms/page.tsx` create body**

```ts
...(options?.promotion_ids?.length
  ? { promotion_ids: options.promotion_ids }
  : options?.promotion_id
    ? { promotion_id: options.promotion_id }
    : {})
```

Update `onCheckout` type accordingly.

- [ ] **Step 5: `cd frontend && npm run lint`** on touched files if practical; `npm run build` after Task 10–11.

---

### Task 10: Kayak checkout promo UI

**Files:**
- Modify: `frontend/src/app/kayaks/page.tsx`

**Interfaces:** same `PromoCodeFields` with `nights={null}`.

- [ ] **Step 1: State `promoIds` + `promoPreview`.**

Place `PromoCodeFields` in the aside form above ราคารวม. Show `PromoPriceBreakdown` with kayak `totalPrice` as base.

- [ ] **Step 2: POST body**

```ts
...(promoIds.length > 0 ? { promotion_ids: promoIds } : {})
```

Submit button still `type="submit"` on the form.

---

### Task 11: Customer wallet on bookings page

**Files:**
- Modify: `frontend/src/app/dashboard/bookings/page.tsx`

- [ ] **Step 1: `GET /promotions/mine`** in `fetchBookings` (ignore 403/empty).

- [ ] **Step 2: Card โค้ดของฉัน** above the room/kayak tabs: code, name, status Thai (`เก็บแล้ว` / `ใช้แล้ว` / `หมดอายุ`), remaining if not null.

Empty: hide the card (no marketing page).

Use `getApiErrorMessage` instead of `catch (err: any)` on cancel in the same file if you touch that handler.

---

### Task 12: Docs + verify

**Files:**
- Modify: `AGENTS.md` (domain / where-to-look)
- Verify builds

- [ ] **Step 1: AGENTS.md**

Add under domain or API map:

- Wallet: `member_promotions` (UNIQUE member+promo). Ledger: `booking_promotions` (room XOR boat header).
- Apply helper: `backend/src/services/promotion-apply.ts`. Persist: `promotion-ledger.ts`.
- `is_collectible` default false. Stack requires every code `stackable`.
- Restore quota on pending/paid cancel or reject only.

- [ ] **Step 2: Verify**

```bash
cd backend && npm run test:promotion-apply && npm run build
cd frontend && npm run build
```

Expected: tests pass; both `tsc`/`next build` exit 0.

Manual (local): type `WELCOME10` on room cart without collect. Create a collectible promo in admin, collect, apply. Cancel pending booking → can apply again. Two non-stackable codes → Thai error. Kayak checkout with one non-collectible code → `booking_promotions.boat_booking_id` set. Admin redemptions panel shows the row.

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Wallet + ledger tables, INTEGER FKs, XOR check | 2 |
| `usage_limit_per_member`, `is_collectible` default false, `stackable` default false | 2, 5, 8 |
| Sequential stack math, kayak ignores min_nights | 1, 7, 10 |
| Collect / uncollect / mine / redemptions | 4, 8, 11 |
| Validate with optional auth + per-member + collect | 5, 9 |
| Room `promotion_id` when exactly one code | 1 (`headerPromotionId`), 6 |
| Kayak ledger only | 7 |
| Restore pending/paid cancel-reject | 1, 3, 6, 7 |
| Admin เช็คโปรโมชั่น UI | 8 |
| Customer collect + stack UI rooms/kayaks | 9, 10 |
| No MySQL teammate SQL | 2 + constraints |
| No package-engine rewrite | (out of scope, no task) |

## Placeholder scan

None of TBD / implement later / similar to Task N without code.
