# Room promotions and slip confirmation

## Scope and environment

- Baseline: local `main`, commit `e6698b626c2f10058514ad3b9fba7c7480b104cf`.
- Backend scenarios use real controllers, express-validator, SQL and booking transactions on a separate local PostgreSQL 18 server. Each run creates and removes its own fixture schema. Mail delivery is stubbed.
- Browser checks run against the local Next.js application in Edge. Every API request is intercepted: these are UI contract checks, independently paired with the PostgreSQL tests, not production end-to-end checks.
- Production Neon promotion constraints were inspected read-only. They permit a zero discount; no schema migration is needed.
- No production promotion, booking or payment was changed during these pre-deployment checks. The results below describe the validated local tree; live deployment verification is separate.

## Reproduced defects and changes

1. `createPromotion` and `updatePromotion` rejected every zero discount with HTTP 400, although the form/validator allow zero. A fixed zero discount is now allowed only with at least one boat entitlement from a room promotion. Percent-zero, negative/non-finite values, and zero without an entitlement remain invalid. Removing the entitlement from a zero-discount promotion is rejected without changing the stored row.
2. `POST /api/promotions/validate` filtered future/expired/exhausted/inactive codes out before checking their rules. Existing codes now reach the shared validation logic and report the actual rejection reason. Unknown codes remain rejected. This does not permit using an ineligible code.
3. `/payment` started a two-second redirect after slip upload and displayed a duplicate success toast. Both are removed for room and kayak payments. The inline confirmation and manual links remain; payment status and upload behavior are unchanged.

## Requested cases

| Case | Code | Expected and observed local result |
| --- | --- | --- |
| 1 | ROOM10PCT | 2,000 minus 10% = 1,800; validation and persisted booking agree. |
| 2 | ROOM20MAX | 2,000 minus capped 300 = 1,700; below 1,000 rejected; a one-night 1,000 booking remains valid. |
| 3 | STAY2NIGHT | One night rejected; two nights at 2,000 minus 15% = 1,700. |
| 4 | VIPROOM500 | Below 2,500 rejected; 3,000 minus 500 = 2,500. |
| 5 | ROOMONCE10 | First booking accepted; another booking by the same member rejected after ledger persistence. |
| 6 | ROOMFIRST1 | First booking accepted; validation and booking by a different member rejected after global quota is consumed. |
| 7 | ROOMFREEBOAT | Fixed zero discount created and edited successfully; a two-room booking receives two distinct physical-room grants, each one free ticket, with no room-price reduction. The collected-wallet path is covered. |
| 8 | ROOMEXPIRED | Past end date rejected by both validation and booking. |
| 9 | ROOMFUTURE | Future start date rejected with “โปรโมชั่นยังไม่เริ่มใช้งาน”; booking also rejected. |
| 10 | ROOMDISABLED | Inactive code rejected by validation and booking. |

All ten form configurations also submit the correct numeric, room-only, addon, active and nullable optional values through the browser. Test dates are relative to the run for backend scenarios; browser date-picker fixtures use a fixed October 2026 clock.

## Verification

- Backend build and existing regression: **135 passed**.
- Frontend build and existing regression: **72 passed**.
- Promotion calculation suite: **22 passed**.
- Targeted PostgreSQL integration (ten scenarios, invalid-zero guard, existing room-type persistence and wallet restoration): **14 passed**, none skipped. Node's count includes the parent scenario test.
- Promotion form browser: **10 configurations passed** with mocked API responses.
- Payment browser: room and kayak, each at **390×844** and **1440×1000**. Successful upload stays on `/payment` beyond the former countdown; no duplicate toast/countdown; manual booking link navigates; no horizontal overflow or JavaScript errors.
- `git diff --check` passed.

## Repeat commands

From `backend/`, set `TEST_DATABASE_URL` to an isolated local PostgreSQL server:

```powershell
npm run test:regression
npm run test:promotion-apply
node --test tests/integration/promotion-scenarios.test.cjs tests/integration/promotion-wallet.test.cjs tests/integration/pr26-promotion-room-types.test.cjs
```

From `frontend/`, use the local dev server on port 3010 and set `PLAYWRIGHT_MODULE` if Playwright is installed outside this package:

```powershell
node --test 'tests/regression/*.test.cjs'
npm run build
node tests/browser/promotion-form.cjs
node tests/browser/payment-success.cjs
```

## Limits

Production UI/API retesting after deployment is still required. These fixture schemas do not recreate every production trigger or migration. Boat entitlement redemption, real email delivery, real transfer and production slip storage are outside this change's verification; only the entitlement grant and confirmation UI were exercised here.
