# Room guest UX verification — 2026-10-20

## Intended behavior

Customers choose dates and physical rooms before reviewing actual guest counts on booking details. A single standard room offers one/two-adult choices, not a numeric input. Larger rooms and multi-room bookings allow group counts. Existing child age, optional bed and occupancy policies still apply. No API/schema changes.

## Verification

- `npm run build`: passed, all 62 routes generated/type-checked; temporary preview route absent.
- `node --test tests/regression/*.test.cjs`: 111 passed, 0 failed.
- Targeted ESLint for the four changed TSX files: 0 errors (existing warnings remain).
- Frontend regression tests include the real guest component, actual checkout submit handler, cart/URL updates and existing occupancy rules.
- One standard room renders one/two-adult choices; six-person room and two standard rooms allow larger counts.
- Adding a child creates an unknown age, preserves existing age zero and requires age before submission.
- Actual API request payload uses reviewed adults, children and ages instead of earlier cart defaults.
- Two adults, infant age zero and child age six fit a two-person room without automatically requesting paid beds.
- Three adults in a two-person room disable payment. Missing age prompts for age first rather than incorrectly demanding another room.
- Changing ages/removing children resets child-bed requests; adult-only edits preserve them.
- Valid edits retain physical rooms, dates and promotion query parameters.
- Browser: search displays only type/date/search controls. The shared interactive component was exercised on a temporary local-only preview route using synthetic data: adult choice, child addition, age six, capacity result, large-room toggle and adult stepper all responded correctly.
- The temporary preview route was removed. No production bookings, payments or account changes were created.

## Browser limits

The local search server could not load the production catalog from its local origin. Therefore live inventory, authenticated booking details and production writes were not tested through this browser session. Component interaction and checkout payloads were verified separately by regression tests. The first local preview used 127.0.0.1, which Next.js development origin checks blocked; localhost worked without changing security settings.
