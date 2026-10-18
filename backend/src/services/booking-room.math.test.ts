import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nightsBetween,
  sumCapacity,
  assertGuestsFitCapacity,
  lineSubtotal,
  sumSubtotals,
  countCapacityChildren,
  childOvercapacityAllowance,
} from './booking-room.math';

describe('booking-room.math', () => {
  it('grants additional places only to eligible children, bounded by room count', () => {
    assert.equal(childOvercapacityAllowance([0, 5, 6, 11, 12, 17], 1), 1);
    assert.equal(childOvercapacityAllowance([6, 7, 11], 2), 2);
    assert.equal(childOvercapacityAllowance([4, 5], 1, 4), 0);
    assert.equal(childOvercapacityAllowance([6, 11], 1, 12), 0);
  });
  it('allows one additional child per room without expanding adult capacity', () => {
    assert.doesNotThrow(() => assertGuestsFitCapacity(2, 1, 2, 1));
    assert.doesNotThrow(() => assertGuestsFitCapacity(4, 2, 4, 2));
    assert.throws(() => assertGuestsFitCapacity(2, 2, 2, 1));
    assert.throws(() => assertGuestsFitCapacity(3, 0, 2, 1));
    assert.throws(() => assertGuestsFitCapacity(5, 1, 4, 2));
  });
  it('uses the configured inclusive boundary and preserves zero', () => {
    assert.equal(countCapacityChildren([0, 4, 5, 6], 5), 2);
    assert.equal(countCapacityChildren([0, 4, 5, 6], 0), 4);
    assert.equal(countCapacityChildren([0, 4, 5, 6], 18), 0);
  });
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
