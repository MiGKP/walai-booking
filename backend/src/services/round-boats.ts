export interface RoundBoatInput {
  boat_type_id: number;
  quantity: number;
}

export interface RoundCandidate {
  boat_round_id: number;
  memberTypeIds: number[];
}

export interface RemainingBoatsInput {
  fleetQuantity: number;
  roundQuantity: number | null;
  typeBooked: number;
  totalSlots: number | null;
  poolBooked: number;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

/** Physical fleet vs boats allocated to this round; never exceed either. */
export function typeCapacity(
  fleetQuantity: number,
  roundQuantity: number | null
): number {
  const fleet = Math.max(0, toPositiveInt(fleetQuantity, 0));
  if (roundQuantity == null || !Number.isFinite(Number(roundQuantity))) {
    return fleet;
  }
  const roundCap = Math.max(0, toPositiveInt(roundQuantity, 0));
  return Math.min(fleet, roundCap);
}

export function remainingBoats(input: RemainingBoatsInput): number {
  const cap = typeCapacity(input.fleetQuantity, input.roundQuantity);
  const remainingType = Math.max(0, cap - Math.max(0, input.typeBooked));
  if (input.totalSlots == null || !Number.isFinite(Number(input.totalSlots))) {
    return remainingType;
  }
  const remainingPool = Math.max(
    0,
    toPositiveInt(input.totalSlots, 0) - Math.max(0, input.poolBooked)
  );
  return Math.min(remainingType, remainingPool);
}

export function parseRoundBoats(body: Record<string, unknown>): RoundBoatInput[] {
  if (Array.isArray(body.boats) && body.boats.length > 0) {
    const parsed: RoundBoatInput[] = [];
    for (const raw of body.boats) {
      if (raw == null || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const boatTypeId = toPositiveInt(item.boat_type_id, 0);
      const quantity = Math.max(1, toPositiveInt(item.quantity, 1));
      if (boatTypeId < 1) continue;
      parsed.push({ boat_type_id: boatTypeId, quantity });
    }
    return parsed;
  }

  const legacyId = toPositiveInt(body.boat_type_id, 0);
  if (legacyId < 1) return [];
  return [{ boat_type_id: legacyId, quantity: 1 }];
}

function sortPreferShared(
  a: RoundCandidate,
  b: RoundCandidate
): number {
  if (b.memberTypeIds.length !== a.memberTypeIds.length) {
    return b.memberTypeIds.length - a.memberTypeIds.length;
  }
  return a.boat_round_id - b.boat_round_id;
}

/** Prefer one shared M2M round that lists every type in the cart. */
export function pickCanonicalRoundId(
  rounds: RoundCandidate[],
  requestedTypeIds: number[]
): number | null {
  const requested = [...new Set(requestedTypeIds)];
  if (requested.length === 0) return null;
  const covering = rounds.filter((round) =>
    requested.every((id) => round.memberTypeIds.includes(id))
  );
  if (covering.length === 0) return null;
  covering.sort(sortPreferShared);
  return covering[0].boat_round_id;
}

export function pickRoundForType(
  rounds: RoundCandidate[],
  typeId: number
): number | null {
  const matches = rounds.filter((round) => round.memberTypeIds.includes(typeId));
  if (matches.length === 0) return null;
  matches.sort(sortPreferShared);
  return matches[0].boat_round_id;
}

export function memberTypeIdsFromRow(row: {
  boat_type_id?: unknown;
  member_type_ids?: unknown;
}): number[] {
  const fromJson = row.member_type_ids;
  if (Array.isArray(fromJson)) {
    return fromJson
      .map((id) => toPositiveInt(id, 0))
      .filter((id) => id > 0);
  }
  if (typeof fromJson === 'string') {
    try {
      const parsed: unknown = JSON.parse(fromJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map((id) => toPositiveInt(id, 0))
          .filter((id) => id > 0);
      }
    } catch {
      // fall through to legacy column
    }
  }
  const legacy = toPositiveInt(row.boat_type_id, 0);
  return legacy > 0 ? [legacy] : [];
}

/** SQL: round `alias` includes boat type param (round_boats, else legacy boat_type_id). */
export function roundIncludesTypeSql(
  roundAlias: string,
  typeExpr: string
): string {
  return `(
    EXISTS (
      SELECT 1 FROM round_boats rb_m
      WHERE rb_m.boat_round_id = ${roundAlias}.boat_round_id
        AND rb_m.boat_type_id = ${typeExpr}
    )
    OR (
      ${roundAlias}.boat_type_id = ${typeExpr}
      AND NOT EXISTS (
        SELECT 1 FROM round_boats rb_legacy
        WHERE rb_legacy.boat_round_id = ${roundAlias}.boat_round_id
      )
    )
  )`;
}

export function roundTypeQuantitySql(
  roundAlias: string,
  typeExpr: string
): string {
  // Legacy 1:1 rounds keep fleet size. Shared M2M rounds (boat_type_id NULL)
  // use round_boats.quantity as the per-type cap for that slot.
  return `CASE
    WHEN ${roundAlias}.boat_type_id IS NOT NULL THEN (
      SELECT COALESCE(bt_q.quantity, 0) FROM boat_types bt_q
      WHERE bt_q.boat_type_id = ${typeExpr}
    )
    ELSE COALESCE(
      (
        SELECT rb_q.quantity FROM round_boats rb_q
        WHERE rb_q.boat_round_id = ${roundAlias}.boat_round_id
          AND rb_q.boat_type_id = ${typeExpr}
      ),
      (
        SELECT bt_q.quantity FROM boat_types bt_q
        WHERE bt_q.boat_type_id = ${typeExpr}
      ),
      0
    )
  END`;
}

export const MEMBER_TYPE_IDS_SQL = `COALESCE(
  (
    SELECT json_agg(rb.boat_type_id ORDER BY rb.boat_type_id)
    FROM round_boats rb
    WHERE rb.boat_round_id = br.boat_round_id
  ),
  CASE
    WHEN br.boat_type_id IS NOT NULL THEN json_build_array(br.boat_type_id)
    ELSE '[]'::json
  END
)`;
