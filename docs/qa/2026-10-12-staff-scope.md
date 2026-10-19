# Staff recovery, profiles, reports and member filters

## Changes

- Password recovery accepts `account_type: customer | staff`; omitted values keep the member behavior. Staff recovery covers admin, room staff and boat staff, requires an enabled account, keeps the generic response, hashes OTPs, enforces expiry and five wrong attempts, and consumes an OTP once. A successful reset revokes earlier sessions.
- Staff self-profile reads and saves name, email, phone, address, LINE and Facebook. Email edits require the current password, reject an existing member/staff email, clear the old recovery token, and detect competing edits. Authenticated staff requests use the current stored email after an edit.
- Reports support daily/monthly summaries, daily revenue, room promotion/package usage and peak dates, room stock by day/type, and boat stock by day/type/round. CSV exports all matching rows; displayed inventory tables paginate at 25 rows. CSV values are quoted and spreadsheet formulas escaped.
- Report access is enforced in the API. Admin sees both services and member totals. Room staff sees room reports; boat staff sees boat reports. Staff report routes have their own role layouts.
- The admin member list combines search, active/inactive status, booking status and service filters with server pagination. `EXISTS` prevents a member with multiple bookings from appearing more than once. `none` means no bookings in the selected service(s).

Existing uncommitted booking-list / live-notification changes were retained. No booking status or payment flow was changed.

## Report definitions

- Counts and revenue use booking creation dates. Revenue includes `approved` and `checked_out`; paid-but-unapproved amounts remain separate.
- Paid room addons are already included in room payment headers. Reports attribute their active amounts to boat revenue and subtract them from room revenue, avoiding duplication in the combined report.
- Package usage excludes cancelled/rejected bookings and deduplicates ledger/header links. Per-type packages use the physical room price snapshots less the recorded type discount. Legacy whole-booking codes share room revenue equally between applied codes. This allocation is a reporting convention, not a new payment rule.
- Inventory uses current catalog quantities and booking line statuses for the selected service days. It is not a preserved historical stock snapshot. Shared boat capacity is applied across all boat types in the same time window; per-type remaining quantities are alternatives and must not be added together as independent capacity.

## Required before deployment

Apply only `backend/src/db/migrations/2026-10-17-staff-password-reset.sql` to the intended database before deploying the changed auth/profile controller. It adds staff `reset_token`, `reset_token_expires_at`, and `reset_attempts` columns. Existing `password_changed_at` remains in use.

The migration was applied twice to an isolated temporary staff table and twice on the existing Neon QA branch `qa-pr26-migration-20261011` to verify rerun safety. It was then applied to Neon production `br-frosty-forest-aoqj9oeb`; all three column types, nullability and the attempt default were verified. The repository's configured `npm run migrate` references a missing `src/db/migrate.ts`; do not assume that command applies this SQL file.

## Validation

| Check | Result / environment |
| --- | --- |
| Backend build | Passed, local TypeScript |
| Frontend build | Passed, local Next.js with TypeScript checks enabled |
| Backend regression | 135 passed, no skipped tests |
| Frontend regression | 72 passed, no skipped tests |
| PostgreSQL integration | 9 passed, no skipped tests; loopback-only temporary tables |
| Browser UI | Passed in headless Edge, local frontend and intercepted API responses |
| Responsive UI | Profiles/reports/member filters at 390×844 and 1440×1000; recovery/reset at 390×844 |
| Changed-page ESLint | No errors; existing member/profile warnings remain |
| Diff whitespace | Passed |

PostgreSQL cases exercise real hashing, login, OTP replacement/reuse/expiry/attempt limits, disabled staff, token revocation, all three staff profiles, duplicate email prevention, competing email changes, post-edit session email, role-separated reports, multi-room package allocation, shared boat capacity, member filter counts, legacy multiple-code allocations and paid-addon revenue deduplication.

The browser suite exercises staff recovery payloads and navigation, profile save/reload and email confirmation, service-separated reports, daily filters, complete CSV export/escaping, member filter request parameters and page overflow. API responses are mocked in this suite; it does not establish production behavior.

## Not yet verified

- Actual OTP email delivery to a staff mailbox on production.
- Deployment and end-to-end live report performance. All eight new report SQL queries were exercised read-only against the production schema/data before deployment, including 62 room inventory rows and 372 boat inventory rows for October 2026.
- An end-to-end browser flow against the deployed updated backend. Database/controller integration and browser contracts were checked separately.

No customer records were written. The only production database change at this checkpoint is the additive staff OTP migration. The user authorized commit and production deployment after the local checks; live verification follows deployment.
