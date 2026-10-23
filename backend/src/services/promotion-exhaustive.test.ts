import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PromoApplyError,
  applyPromotionList,
  headerPromotionId,
  isPromoInWindow,
  parseAppliesTo,
  parseBookingScope,
  parsePromotionIds,
  promoAllowsScope,
  shouldRestoreQuota,
  singleDiscount,
  walletStatusAfterUse,
  type CatalogPromo,
} from './promotion-apply';

function promo(partial: Partial<CatalogPromo> & Pick<CatalogPromo, 'id'>): CatalogPromo {
  return {
    code: 'PROMO_' + partial.id,
    name: 'Promo ' + partial.id,
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

describe('EXHAUSTIVE PROMOTION TEST SUITE', () => {
  const now = new Date('2026-10-19T00:00:00Z');

  describe('1. Math & Discount Calculations', () => {
    it('Case 1: Percent discount without max_discount (20% of 1000 = 200, remaining 800)', () => {
      const p = promo({ id: 1, discount_type: 'percent', discount_value: 20 });
      const { discountAmount, nextTotal } = singleDiscount(p, 1000, 1);
      assert.equal(discountAmount, 200);
      assert.equal(nextTotal, 800);
    });

    it('Case 2: Percent discount with max_discount cap (20% of 1000 capped at 100)', () => {
      const p = promo({ id: 1, discount_type: 'percent', discount_value: 20, max_discount: 100 });
      const { discountAmount, nextTotal } = singleDiscount(p, 1000, 1);
      assert.equal(discountAmount, 100);
      assert.equal(nextTotal, 900);
    });

    it('Case 3: Fixed discount less than base price (150 off 1000 = 850)', () => {
      const p = promo({ id: 1, discount_type: 'fixed', discount_value: 150 });
      const { discountAmount, nextTotal } = singleDiscount(p, 1000, 1);
      assert.equal(discountAmount, 150);
      assert.equal(nextTotal, 850);
    });

    it('Case 4: Fixed discount greater than base price (500 off 300 = 300, remaining 0, never negative)', () => {
      const p = promo({ id: 1, discount_type: 'fixed', discount_value: 500 });
      const { discountAmount, nextTotal } = singleDiscount(p, 300, 1);
      assert.equal(discountAmount, 300);
      assert.equal(nextTotal, 0);
    });

    it('Case 5: 100% discount reduces remaining to exactly 0', () => {
      const p = promo({ id: 1, discount_type: 'percent', discount_value: 100 });
      const { discountAmount, nextTotal } = singleDiscount(p, 1500, 1);
      assert.equal(discountAmount, 1500);
      assert.equal(nextTotal, 0);
    });

    it('Case 6: Discount rounding rounds half up to whole baht', () => {
      const p = promo({ id: 1, discount_type: 'percent', discount_value: 15 });
      const { discountAmount, nextTotal } = singleDiscount(p, 99, 1);
      // 15% of 99 = 14.85 -> rounded to 15
      assert.equal(discountAmount, 15);
      assert.equal(nextTotal, 84);
    });
  });

  describe('2. Stacking & Deterministic Ordering', () => {
    it('Case 7: Single code with stackable=false applies successfully', () => {
      const result = applyPromotionList([promo({ id: 1, stackable: false, discount_type: 'fixed', discount_value: 100 })], {
        memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(result.totalPrice, 900);
      assert.equal(result.headerPromotionId, 1);
    });

    it('Case 8: Two codes where one is non-stackable throws PromoApplyError', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, stackable: false }), promo({ id: 2, stackable: true })], {
          memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /คูปองส่วนลดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้/);
    });

    it('Case 9: Two codes where both are non-stackable throws PromoApplyError', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, stackable: false }), promo({ id: 2, stackable: false })], {
          memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /คูปองส่วนลดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้/);
    });

    it('Case 10: Duplicate promotion ID in the list throws PromoApplyError', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, stackable: true }), promo({ id: 1, stackable: true })], {
          memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /ไม่สามารถใช้คูปองซ้ำในบิลเดียวกันได้/);
    });

    it('Case 11: Two stackable codes apply fixed discount before percent discount regardless of input order', () => {
      const fixed = promo({ id: 1, stackable: true, discount_type: 'fixed', discount_value: 200 });
      const percent = promo({ id: 2, stackable: true, discount_type: 'percent', discount_value: 10 });
      const ctx = { memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {} };

      // Fixed first: 1000 - 200 = 800. Percent: 10% of 800 = 80. Total: 720.
      const r1 = applyPromotionList([fixed, percent], ctx);
      const r2 = applyPromotionList([percent, fixed], ctx);
      assert.equal(r1.totalPrice, 720);
      assert.equal(r2.totalPrice, 720);
      assert.equal(r1.lines[0].discount_amount, 200);
      assert.equal(r1.lines[1].discount_amount, 80);
      assert.equal(r1.headerPromotionId, null);
    });

    it('Case 12: Three stackable codes compute in deterministic order', () => {
      const fixed1 = promo({ id: 1, stackable: true, discount_type: 'fixed', discount_value: 100 });
      const fixed2 = promo({ id: 2, stackable: true, discount_type: 'fixed', discount_value: 50 });
      const percent = promo({ id: 3, stackable: true, discount_type: 'percent', discount_value: 20 });
      const ctx = { memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {} };

      // 1000 - 100 - 50 = 850. 20% of 850 = 170. Total: 680.
      const res = applyPromotionList([percent, fixed2, fixed1], ctx);
      assert.equal(res.totalPrice, 680);
      assert.equal(res.lines.reduce((s, l) => s + l.discount_amount, 0), 320);
    });

    it('Case 13: Stacking that reduces total to 0 caps remaining discounts at 0', () => {
      const hugeFixed = promo({ id: 1, stackable: true, discount_type: 'fixed', discount_value: 1000 });
      const percent = promo({ id: 2, stackable: true, discount_type: 'percent', discount_value: 10 });
      const ctx = { memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {} };

      const res = applyPromotionList([hugeFixed, percent], ctx);
      assert.equal(res.totalPrice, 0);
      assert.equal(res.lines[0].discount_amount, 500);
      assert.equal(res.lines[1].discount_amount, 0);
    });
  });

  describe('3. Scope Rules (applies_to vs scope)', () => {
    it('Case 14: applies_to: room on room scope is allowed', () => {
      const res = applyPromotionList([promo({ id: 1, applies_to: 'room', discount_type: 'fixed', discount_value: 50 })], {
        memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 15: applies_to: room on kayak scope throws error', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, applies_to: 'room' })], {
          memberId: 1, nights: null, basePrice: 500, now, scope: 'kayak', memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /คูปองนี้ใช้กับห้องพักเท่านั้น/);
    });

    it('Case 16: applies_to: kayak on kayak scope is allowed', () => {
      const res = applyPromotionList([promo({ id: 1, applies_to: 'kayak', discount_type: 'fixed', discount_value: 30 })], {
        memberId: 1, nights: null, basePrice: 200, now, scope: 'kayak', memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 170);
    });

    it('Case 17: applies_to: kayak on room scope throws error', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, applies_to: 'kayak' })], {
          memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /คูปองนี้ใช้กับเรือคายัคเท่านั้น/);
    });

    it('Case 18 & 19: applies_to: both works on both room and kayak scopes', () => {
      const bothPromo = promo({ id: 1, applies_to: 'both', discount_type: 'fixed', discount_value: 50 });
      const roomRes = applyPromotionList([bothPromo], {
        memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      const kayakRes = applyPromotionList([bothPromo], {
        memberId: 1, nights: null, basePrice: 200, now, scope: 'kayak', memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(roomRes.totalPrice, 450);
      assert.equal(kayakRes.totalPrice, 150);
    });

    it('Case 20: undefined scope allows promo through', () => {
      const res = applyPromotionList([promo({ id: 1, applies_to: 'room', discount_type: 'fixed', discount_value: 50 })], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });
  });

  describe('4. Room Type Targeting', () => {
    it('Case 21: Promo targeting room_type_ids: [1, 2] allows booking room [1]', () => {
      const res = applyPromotionList([promo({ id: 1, applies_to: 'room', room_type_ids: [1, 2], discount_type: 'fixed', discount_value: 50 })], {
        memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', roomTypeIds: [1], memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 22: Promo targeting room_type_ids: [1, 2] rejects booking room [3]', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, applies_to: 'room', room_type_ids: [1, 2], discount_type: 'fixed', discount_value: 50 })], {
          memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', roomTypeIds: [3], memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ใช้กับประเภทห้องที่กำหนดเท่านั้น/);
    });

    it('Case 23: Multi-room booking where some rooms do not match throws error', () => {
      assert.throws(() => {
        applyPromotionList([promo({ id: 1, applies_to: 'room', room_type_ids: [1, 2], discount_type: 'fixed', discount_value: 50 })], {
          memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', roomTypeIds: [1, 4], memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ใช้กับประเภทห้องที่กำหนดเท่านั้น/);
    });

    it('Case 24: Promo with empty room_type_ids allows any room type', () => {
      const res = applyPromotionList([promo({ id: 1, applies_to: 'room', room_type_ids: [], discount_type: 'fixed', discount_value: 50 })], {
        memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', roomTypeIds: [99], memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 25 & 26: Legacy room_type_id fallback works for match and mismatch', () => {
      const p = promo({ id: 1, applies_to: 'room', room_type_id: 5, discount_type: 'fixed', discount_value: 50 });
      const ok = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', roomTypeIds: [5], memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(ok.totalPrice, 450);

      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, scope: 'room', roomTypeIds: [6], memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ใช้กับประเภทห้องที่กำหนดเท่านั้น/);
    });
  });

  describe('5. Threshold Conditions (min_nights & min_price)', () => {
    it('Case 27: min_nights satisfied applies discount', () => {
      const p = promo({ id: 1, min_nights: 3, discount_type: 'fixed', discount_value: 100 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 3, basePrice: 1500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 1400);
    });

    it('Case 28: min_nights not satisfied throws error', () => {
      const p = promo({ id: 1, min_nights: 3, discount_type: 'fixed', discount_value: 100 });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 2, basePrice: 1500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ต้องจองขั้นต่ำ 3 คืน/);
    });

    it('Case 29: min_nights ignored for kayak (nights=null)', () => {
      const p = promo({ id: 1, min_nights: 3, discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: null, basePrice: 300, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 250);
    });

    it('Case 30: min_price satisfied applies discount', () => {
      const p = promo({ id: 1, min_price: 1000, discount_type: 'fixed', discount_value: 100 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 1000, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 900);
    });

    it('Case 31: min_price not satisfied throws error', () => {
      const p = promo({ id: 1, min_price: 1000, discount_type: 'fixed', discount_value: 100 });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 999, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ต้องมียอดขั้นต่ำ/);
    });

    it('Case 32: skipMinPrice=true bypasses min_price check', () => {
      const p = promo({ id: 1, min_price: 1000, discount_type: 'fixed', discount_value: 100 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, skipMinPrice: true, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 400);
    });
  });

  describe('6. Time Windows & Dates', () => {
    it('Case 33: future promotions report that they have not started', () => {
      const p = promo({ id: 1, start_date: '2026-10-25' });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นยังไม่เริ่มใช้งาน/);
    });

    it('Case 34: start_date today is valid and allowed', () => {
      const p = promo({ id: 1, start_date: '2026-10-19', discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 35: end_date in past throws promo expired', () => {
      const p = promo({ id: 1, end_date: '2026-10-10' });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นหมดอายุแล้ว/);
    });

    it('Case 36: end_date today is valid and allowed', () => {
      const p = promo({ id: 1, end_date: '2026-10-19', discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 37: inactive promotions report that they are disabled', () => {
      const p = promo({ id: 1, is_active: false });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ปิดใช้งานแล้ว/);
    });

    it('Case 38: null start_date and end_date are always in window', () => {
      const p = promo({ id: 1, start_date: null, end_date: null });
      assert.equal(isPromoInWindow(p, now), true);
    });
  });

  describe('7. Limits & Quotas', () => {
    it('Case 39: usage_limit reached throws error', () => {
      const p = promo({ id: 1, usage_limit: 5, usage_count: 5 });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
        });
      }, /โปรโมชั่นนี้ถูกใช้ครบจำนวนแล้ว/);
    });

    it('Case 40: usage_limit not yet reached applies successfully', () => {
      const p = promo({ id: 1, usage_limit: 5, usage_count: 4, discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {}, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 41: usage_limit_per_member reached throws error', () => {
      const p = promo({ id: 1, usage_limit_per_member: 2 });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: { 1: 2 }, walletsByPromoId: {}
        });
      }, /ใช้คูปองนี้ครบจำนวนครั้งแล้ว/);
    });

    it('Case 42: usage_limit_per_member not yet reached allows booking', () => {
      const p = promo({ id: 1, usage_limit_per_member: 2, discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: { 1: 1 }, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });

    it('Case 43: unlimited per member allows multiple uses', () => {
      const p = promo({ id: 1, usage_limit_per_member: null, discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: { 1: 99 }, walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
    });
  });

  describe('8. Collectibles & Wallet', () => {
    it('Case 44: Collectible code with wallet status "saved" is allowed', () => {
      const p = promo({ id: 1, is_collectible: true, discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {},
        walletsByPromoId: { 1: { member_promotion_id: 10, status: 'saved' } }
      });
      assert.equal(res.totalPrice, 450);
      assert.equal(res.lines[0].member_promotion_id, 10);
    });

    it('Case 45: Collectible code with wallet status "expired" throws error', () => {
      const p = promo({ id: 1, is_collectible: true });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {},
          walletsByPromoId: { 1: { member_promotion_id: 10, status: 'expired' } }
        });
      }, /ต้องเก็บคูปองนี้ก่อนใช้/);
    });

    it('Case 46: Collectible code without wallet row throws error', () => {
      const p = promo({ id: 1, is_collectible: true });
      assert.throws(() => {
        applyPromotionList([p], {
          memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {},
          walletsByPromoId: {}
        });
      }, /ต้องเก็บคูปองนี้ก่อนใช้/);
    });

    it('Case 47: Non-collectible promo (type-in code) works without wallet', () => {
      const p = promo({ id: 1, is_collectible: false, discount_type: 'fixed', discount_value: 50 });
      const res = applyPromotionList([p], {
        memberId: 1, nights: 1, basePrice: 500, now, memberUsedCountByPromoId: {},
        walletsByPromoId: {}
      });
      assert.equal(res.totalPrice, 450);
      assert.equal(res.lines[0].member_promotion_id, null);
    });
  });

  describe('9. Quota Restoration & Header ID', () => {
    it('Case 48-51: shouldRestoreQuota allows only pending and paid', () => {
      assert.equal(shouldRestoreQuota('pending'), true);
      assert.equal(shouldRestoreQuota('paid'), true);
      assert.equal(shouldRestoreQuota('approved'), false);
      assert.equal(shouldRestoreQuota('checked_out'), false);
      assert.equal(shouldRestoreQuota('rejected'), false);
      assert.equal(shouldRestoreQuota('cancelled'), false);
    });

    it('Case 52-54: headerPromotionId returns singular ID or null when stacked', () => {
      assert.equal(headerPromotionId([42]), 42);
      assert.equal(headerPromotionId([42, 43]), null);
      assert.equal(headerPromotionId([]), null);
    });
  });
});
