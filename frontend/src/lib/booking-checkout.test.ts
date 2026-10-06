import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCheckoutDetails, chooseRoomPromotions, eligibleRoomPromotion, roomPromotionDiscount } from './booking-checkout';
import type { CheckoutPromotion } from './booking-checkout';

const promo: CheckoutPromotion = {
  id: 7, name: 'ลด 10%', code: 'ROOM10', discount_type: 'percent', discount_value: 10,
  min_nights: null, min_price: null, max_discount: null, applies_to: 'room',
  is_collectible: false, wallet_status: null,
};

test('missing age tokens stay invalid rather than becoming infants', () => {
  const actual = resolveCheckoutDetails(new URLSearchParams('child_ages=,10'), null);
  assert.equal(Number.isNaN(actual.childAges[0]), true);
  assert.equal(actual.childAges[1], 10);
  assert.deepEqual(resolveCheckoutDetails(new URLSearchParams('child_ages='), null).childAges, []);
});

test('checkout discounts follow server rounding and fixed-code cap semantics', () => {
  assert.equal(roomPromotionDiscount(promo, 999), 100);
  assert.equal(roomPromotionDiscount({ ...promo, discount_type: 'fixed', discount_value: 100, max_discount: 10 }, 999), 100);
});

test('a direct room link retains cart dates, guests and child ages on checkout', () => {
  const actual = resolveCheckoutDetails(new URLSearchParams(), {
    check_in: '2026-11-01', check_out: '2026-11-03', adults: 2, children: 1, child_ages: [0], items: [],
  });
  assert.deepEqual(actual, { checkIn: '2026-11-01', checkOut: '2026-11-03', adults: 2, children: 1, childAges: [0] });
});

test('explicit search dates take precedence so a mismatch can be detected', () => {
  const actual = resolveCheckoutDetails(new URLSearchParams('check_in=2026-12-01&check_out=2026-12-02'), {
    check_in: '2026-11-01', check_out: '2026-11-03', adults: 2, children: 0, items: [],
  });
  assert.equal(actual.checkIn, '2026-12-01');
  assert.equal(actual.checkOut, '2026-12-02');
});

test('one promo is selected only once in a two-type room cart', () => {
  const actual = chooseRoomPromotions([{typeId: 1, totalBasePrice: 1000}, {typeId: 2, totalBasePrice: 2000}], [promo], 2);
  assert.equal(Object.values(actual).filter(id => id === 7).length, 1);
  assert.equal(actual[2], 7);
  assert.equal(actual[1], null);
});

test('room checkout excludes kayak, uncollected and minimum-price promos', () => {
  assert.equal(eligibleRoomPromotion({...promo, applies_to: 'kayak'}, 1000, 2), false);
  assert.equal(eligibleRoomPromotion({...promo, is_collectible: true}, 1000, 2), false);
  assert.equal(eligibleRoomPromotion({...promo, min_price: 1500}, 1000, 2), false);
  assert.equal(eligibleRoomPromotion({...promo, is_collectible: true, wallet_status: 'saved'}, 1000, 2), true);
  assert.equal(eligibleRoomPromotion({...promo, wallet_status: 'used', is_collectible: true}, 1000, 2), false);
});
