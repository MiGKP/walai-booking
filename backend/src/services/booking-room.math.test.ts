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
    assert.equal(
      sumCapacity([
        { capacity: 2, quantity: 2 },
        { capacity: 4, quantity: 1 },
      ]),
      8
    );
  });

  it('throws when guests exceed capacity sum', () => {
    assert.throws(() => assertGuestsFitCapacity(6, 0, 4));
  });

  it('computes line subtotal and total', () => {
    assert.equal(lineSubtotal(1500, 2), 3000);
    assert.equal(sumSubtotals([3000, 2000]), 5000);
  });
});
