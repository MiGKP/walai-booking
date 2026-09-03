import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boatsNeeded,
  lineSubtotal,
  sumPassengerCounts,
  sumSubtotals,
} from './booking-boat.math';

describe('booking-boat.math', () => {
  it('computes boats needed with ceiling', () => {
    assert.equal(boatsNeeded(11, 2), 6);
    assert.equal(boatsNeeded(2, 2), 1);
    assert.equal(boatsNeeded(3, 2), 2);
  });

  it('throws when passengers or seats invalid', () => {
    assert.throws(() => boatsNeeded(0, 2));
    assert.throws(() => boatsNeeded(2, 0));
  });

  it('computes line subtotal and sums', () => {
    assert.equal(lineSubtotal(200, 3), 600);
    assert.equal(sumPassengerCounts([{ num_passengers: 3 }, { num_passengers: 2 }]), 5);
    assert.equal(sumSubtotals([600, 400]), 1000);
  });
});
