import { Pool } from 'pg';
import {
  ApplyContext,
  ApplyResult,
  CatalogPromo,
  PromoApplyError,
  shouldRestoreQuota,
  walletStatusAfterUse,
} from './promotion-apply';

type QueryClient = { query: Pool['query'] };

function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapCatalogRow(row: Record<string, unknown>): CatalogPromo {
  const discountType = row.discount_type === 'fixed' ? 'fixed' : 'percent';
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    discount_type: discountType,
    discount_value: Number(row.discount_value),
    min_nights: toNullableNumber(row.min_nights),
    min_price: toNullableNumber(row.min_price),
    max_discount: toNullableNumber(row.max_discount),
    usage_limit: toNullableNumber(row.usage_limit),
    usage_count: Number(row.usage_count ?? 0),
    is_active: Boolean(row.is_active),
    start_date: (row.start_date as string | Date | null) ?? null,
    end_date: (row.end_date as string | Date | null) ?? null,
    usage_limit_per_member: toNullableNumber(row.usage_limit_per_member),
    is_collectible: Boolean(row.is_collectible),
    stackable: Boolean(row.stackable),
  };
}

export async function loadPromosForApply(
  client: QueryClient,
  ids: number[]
): Promise<CatalogPromo[]> {
  if (ids.length === 0) return [];
  const res = await client.query(
    `SELECT id, code, name, description, discount_type, discount_value,
            min_nights, min_price, max_discount, usage_limit, usage_count,
            is_active, start_date, end_date,
            usage_limit_per_member, is_collectible, stackable
     FROM promotions WHERE id = ANY($1::int[])`,
    [ids]
  );
  const byId = new Map<number, CatalogPromo>();
  for (const row of res.rows as Record<string, unknown>[]) {
    const mapped = mapCatalogRow(row);
    byId.set(mapped.id, mapped);
  }
  const ordered: CatalogPromo[] = [];
  for (const id of ids) {
    const found = byId.get(id);
    if (!found) {
      throw new PromoApplyError('โปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว');
    }
    ordered.push(found);
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
  for (const row of used.rows as Array<{ promotion_id: number; n: number }>) {
    memberUsedCountByPromoId[Number(row.promotion_id)] = Number(row.n);
  }
  const wallets = await client.query(
    `SELECT member_promotion_id, promotion_id, status
     FROM member_promotions
     WHERE member_id = $1 AND promotion_id = ANY($2::int[])`,
    [memberId, promoIds]
  );
  for (const row of wallets.rows as Array<{
    member_promotion_id: number;
    promotion_id: number;
    status: 'saved' | 'used' | 'expired';
  }>) {
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
  for (const row of rows.rows as Array<{
    promotion_id: number;
    member_id: number;
    member_promotion_id: number | null;
  }>) {
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
