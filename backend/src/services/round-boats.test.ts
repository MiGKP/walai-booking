import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseRoundBoats,
  pickCanonicalRoundId,
  pickRoundForType,
  remainingBoats,
  typeCapacity,
} from './round-boats';

describe('typeCapacity', () => {
  it('returns fleet size when round has no per-type quota', (): void => {
    assert.equal(typeCapacity(10, null), 10);
  });

  it('caps fleet by round_boats quantity', (): void => {
    assert.equal(typeCapacity(10, 3), 3);
    assert.equal(typeCapacity(2, 8), 2);
  });

  it('returns 0 when either side is empty', (): void => {
    assert.equal(typeCapacity(0, 5), 0);
    assert.equal(typeCapacity(5, 0), 0);
  });
});

describe('remainingBoats', () => {
  it('returns type remaining when pool is unlimited', (): void => {
    assert.equal(
      remainingBoats({
        fleetQuantity: 10,
        roundQuantity: 4,
        typeBooked: 1,
        totalSlots: null,
        poolBooked: 0,
      }),
      3
    );
  });

  it('returns the tighter of type quota and shared pool', (): void => {
    assert.equal(
      remainingBoats({
        fleetQuantity: 10,
        roundQuantity: 6,
        typeBooked: 1,
        totalSlots: 8,
        poolBooked: 7,
      }),
      1
    );
  });
});

describe('parseRoundBoats', () => {
  it('reads boats array from admin payload', (): void => {
    assert.deepEqual(
      parseRoundBoats({
        boats: [
          { boat_type_id: 1, quantity: 3 },
          { boat_type_id: '2', quantity: '1' },
        ],
      }),
      [
        { boat_type_id: 1, quantity: 3 },
        { boat_type_id: 2, quantity: 1 },
      ]
    );
  });

  it('falls back to legacy single boat_type_id', (): void => {
    assert.deepEqual(parseRoundBoats({ boat_type_id: 4 }), [
      { boat_type_id: 4, quantity: 1 },
    ]);
  });

  it('returns empty when neither boats nor boat_type_id is present', (): void => {
    assert.deepEqual(parseRoundBoats({}), []);
  });
});

describe('pickCanonicalRoundId', () => {
  it('returns shared round that includes every requested type', (): void => {
    const picked = pickCanonicalRoundId(
      [
        { boat_round_id: 10, memberTypeIds: [1] },
        { boat_round_id: 20, memberTypeIds: [1, 3] },
      ],
      [1, 3]
    );
    assert.equal(picked, 20);
  });

  it('returns null when no round covers all requested types', (): void => {
    const picked = pickCanonicalRoundId(
      [{ boat_round_id: 10, memberTypeIds: [1] }],
      [1, 3]
    );
    assert.equal(picked, null);
  });
});

describe('pickRoundForType', () => {
  it('prefers the round with the largest membership', (): void => {
    const picked = pickRoundForType(
      [
        { boat_round_id: 10, memberTypeIds: [1] },
        { boat_round_id: 20, memberTypeIds: [1, 3] },
      ],
      1
    );
    assert.equal(picked, 20);
  });
});
