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
    applies_to: 'both',
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

  it('rejects a room-only code on kayak scope', (): void => {
    assert.throws(
      () =>
        applyPromotionList([promo({ id: 1, applies_to: 'room' })], {
          memberId: 1,
          nights: null,
          basePrice: 200,
          now,
          memberUsedCountByPromoId: {},
          walletsByPromoId: {},
          scope: 'kayak',
        }),
      (err: unknown) =>
        err instanceof PromoApplyError &&
        err.message === 'โค้ดนี้ใช้กับห้องพักเท่านั้น'
    );
  });

  it('rejects a kayak-only code on room scope', (): void => {
    assert.throws(
      () =>
        applyPromotionList([promo({ id: 1, applies_to: 'kayak' })], {
          memberId: 1,
          nights: 1,
          basePrice: 500,
          now,
          memberUsedCountByPromoId: {},
          walletsByPromoId: {},
          scope: 'room',
        }),
      (err: unknown) =>
        err instanceof PromoApplyError &&
        err.message === 'โค้ดนี้ใช้กับเรือคายัคเท่านั้น'
    );
  });

  it('allows a both code on kayak scope', (): void => {
    const result = applyPromotionList(
      [promo({ id: 1, applies_to: 'both', discount_type: 'fixed', discount_value: 50 })],
      {
        memberId: 1,
        nights: null,
        basePrice: 200,
        now,
        memberUsedCountByPromoId: {},
        walletsByPromoId: {},
        scope: 'kayak',
      }
    );
    assert.equal(result.totalPrice, 150);
  });

  it('allows a room-only code on room scope', (): void => {
    const result = applyPromotionList(
      [promo({ id: 1, applies_to: 'room', discount_type: 'fixed', discount_value: 50 })],
      {
        memberId: 1,
        nights: 1,
        basePrice: 500,
        now,
        memberUsedCountByPromoId: {},
        walletsByPromoId: {},
        scope: 'room',
      }
    );
    assert.equal(result.totalPrice, 450);
  });

  it('skips applies_to check when scope is omitted', (): void => {
    const result = applyPromotionList(
      [promo({ id: 1, applies_to: 'room', discount_type: 'fixed', discount_value: 50 })],
      {
        memberId: 1,
        nights: null,
        basePrice: 200,
        now,
        memberUsedCountByPromoId: {},
        walletsByPromoId: {},
      }
    );
    assert.equal(result.totalPrice, 150);
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
