# Admin Room Type → Zone + Next Numbers (Feature E)

## Problem

From the room-types admin list, clicking a type already links to `/admin/rooms/single?type_id=…`, but the single-rooms page ignores that query. Admins must re-select the type before the existing prefix / next-number helpers run. The friend request is: click a type and immediately see the zone (letter prefix) and continuing room numbers.

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Zone meaning | Existing letter **prefix** derived from `room_types.type_name` (unchanged API rule) |
| Schema | **No** new DB columns / tables |
| Entry | Keep link from types → single with `?type_id=` |
| UX | Auto-select type from query + clear label: zone prefix + next number; filter list to that type |
| Approach | **C** — wire `type_id` + clearer bulk/form copy on single page |

## Current behavior (keep)

- `GET /api/rooms/single/next-number?room_type_id=` returns `{ prefix, next_number }`
- Prefix = first letter of 2nd word of `type_name`, else first word
- Bulk draft generator builds `{prefix}{start}…{prefix}{start+qty-1}` and checks duplicates

## Changes

### Frontend — `frontend/src/app/admin/rooms/single/page.tsx`

1. Read `type_id` from `useSearchParams`.
2. When types finish loading and `type_id` is valid:
   - Set type select to that id
   - Call existing `handleRoomTypeChange` / next-number fetch
   - Set type filter so the table shows rooms of that type
3. Show a visible chip/label near the create form, e.g. Thai: `โซน {prefix} · เลขถัดไป {prefix}{next}` (only when prefix known and not editing an existing room).
4. If `type_id` missing/invalid → no change to current empty form.

### Frontend — types page (optional polish)

- Keep existing link `href=/admin/rooms/single?type_id=${rt.id}`
- No required change unless copy wants “จัดการโซน/เลขห้อง”

### Backend

- No API or migration changes required for v1.

## Out of scope

- Dedicated `zone` column on `room_types` / `rooms`
- Changing prefix derivation rules
- Inline expand panel on the types page (approach B)

## Testing checklist

1. From `/admin/rooms/types`, click room count link → single page opens with that type selected.
2. Zone chip shows correct prefix; start number continues after highest existing `{prefix}N`.
3. Generate drafts / save still works; duplicate numbers still blocked.
4. Direct visit to `/admin/rooms/single` without query still works.
5. Frontend build passes.

## Files likely touched

- `frontend/src/app/admin/rooms/single/page.tsx`
- Spec only otherwise (this file)
