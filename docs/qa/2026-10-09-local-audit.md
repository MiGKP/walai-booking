# Walai Booking audit — 9 October 2026

## Scope and baseline

Read AGENTS.md; initial working tree was clean. Branch `codex/review-bug-fixes`, HEAD `f926826678c7ae2802be2843a2d8214d20e2dc2e`, equal to fetched `origin/main` (0 ahead / 0 behind). No subagents, commits, pushes, deployments, production data writes, real payments or actual email delivery were used.

Public production reads confirmed boat availability/operating-hour responses and the mobile overflow. Actions for the baseline commit had succeeded; the exact deployed backend SHA was not newly verified. Local fixes below are not deployed. PostgreSQL tests used only a loopback server on port 55439, random schemas or temporary tables, with cleanup. Mail/Cloudinary boundaries are stubbed in controller tests; real PostgreSQL and bcrypt are used in the relevant integration tests.

User-confirmed policies: zero-charge rooms may be approved without a slip; adults are 12+, children 0–11; the free-child capacity threshold remains a separate resort setting; room boat rights include both check-in and check-out dates.

## Results

| ปัญหา | สาเหตุ | สิ่งที่แก้ | วิธีทดสอบ | ผล | สิ่งที่ยังรอ |
|---|---|---|---|---|---|
| A อนุมัติห้องก่อนสลิป | status endpoint did not enforce paid + slip | guard under header lock; preserve zero-charge exception in both approval paths and UI | positive/zero/blank-slip/status controller tests and rendered staff actions | แก้แล้วและทดสอบผ่าน local | logged-in TEST staff browser flow |
| B สิทธิ์เลือกรอบ 15:00 ไม่ได้ | old symptom not reproduced for valid future round; todayISO depended on browser timezone | Bangkok calendar date | component with 10 available boats, exact advance boundary, closed days and inclusive stay tests | รอบเดิมตรวจแล้วไม่พบในเงื่อนไขทดสอบปัจจุบัน; timezone แก้แล้ว | reproduce original customer account/context on TEST data |
| C overview #? | API boat_booking_id mapped as id | use real IDs/name; link to searched booking list | normal and addon rendered rows/links | แก้แล้วและทดสอบผ่าน local | authenticated browser click; link opens a filtered list rather than auto-opening a detail modal |
| ติดต่อ/แผนที่ | landing treated settings array as one record and used sample fallbacks | pick main row; actual phone/hours/address/coordinates; show missing-data copy | helper tests and local browser reading public API | แก้แล้วและทดสอบผ่าน | deployment not authorized |
| อายุ/ความจุเด็ก | age range 0–17 conflicted with 0–11 copy; cart counted free infants | 0–11 validation/options; cart uses resort free-child cutoff | 11 accepted /12 rejected; configured cutoff and missing age tests | แก้แล้วและทดสอบผ่าน | historical booking ages untouched; stored old carts with 12+ need user correction |
| โปรโมชั่น | existing common service already validates scope, type, quotas and stacking; null dates supported | no production quota/history repair | 19 promotion service tests, catalog/type regressions, PG wallet use/restore twice | ตรวจแล้วไม่พบในกรณีที่ทดสอบ | exhaustive production catalog price comparisons and concurrent final coupon quota across separate connections |
| สลิป | generic filter Error returned 500 for user file errors | Thai 400; frontend extension/MIME/5MiB validation; preserve previous accepted selection | actual Express/Multer multipart invalid type/extension/size; concurrent controller uploads | แก้แล้วและทดสอบผ่าน local | real TEST Cloudinary upload; file content signature validation not added |
| ตะกร้า/จองซ้อน | date-change clearing existed without explanation; free-child capacity mismatch | notify after clearing changed-date cart; fixed capacity | existing selected-room tests; PG 5 parallel room requests: 1×201 +4×409, one persisted room | แก้แล้ว/ตรวจแล้วผ่าน local | cross-tab customer browser flow |
| สิทธิ์เรือ | current inclusive dates, balance and expiry guards already present | Bangkok date fix only | room-addon ownership/date/balance/ended-line regressions; expiry/repeated restoration tests | ตรวจแล้วไม่พบในกรณีที่ทดสอบ | complete wallet/physical-room real DB concurrent redemption and production TEST UI |
| รีวิว | completed ownership and unique constraint already protect creation | no moderation feature added | PG rejects unfinished/foreign/wrong-type/duplicate; owner-only update/delete; /reviews exists in build | ตรวจแล้วไม่พบในกรณีที่ทดสอบ | TEST browser links and mail links; publishing/hiding is a feature decision |
| พนักงานห้อง | line-level check-in already shipped | no new status added | actual PG concurrent check-in vs cancellation, final two room checkouts | ตรวจแล้วไม่พบในกรณีที่ทดสอบ | real staff search and full browser check-in/out |
| หลายห้อง/พิมพ์/ปฏิทิน | detail and calendar used first header room | every physical room/type/subtotal; shared staff/admin calendar titles | render 2 different room types and 6000 total; inspect shared routes | แก้แล้วและทดสอบผ่าน render tests | browser print/PDF visual check and real dates |
| พนักงานเรือ | room addons must await parent approval; dedicated handout is addon-only | no new workflow invented | addon approval/parent guards; PG last boat 5 parallel requests ->1×201 +4×409; existing return sync inspected | ตรวจแล้วไม่พบในกรณีที่ทดสอบ | full approve/return UI; confirm whether ordinary bookings need handout recording |
| มือถือ | grid min-content stretched calendar; footer email overflowed tablet | explicit single grid column/minmax/min-w-0; wrap footer email | production390 width484; local loaded-data widths320/390/768/1280 no horizontal overflow after fixes; select round/boat without submitting | แก้แล้วและทดสอบผ่าน browser | authenticated entitlement panels on mobile |
| OTP | no current failure found | new integration test; no auth production code changed | real PG/bcrypt: old OTP fails, new succeeds once, old password401/new200, old JWT401/new accepted | ตรวจแล้วไม่พบใน local flow | actual email/Google and production TEST browser reset not completed |
| สิทธิ์ role | booking/review routes use auth+role guards; confirmPayment separates staff services | no role changes | source audit and existing settings/auth regressions | ตรวจโค้ดแล้ว | complete member/room_staff/boat_staff/admin HTTP + browser matrix not yet run |

## Verification

- Backend `npm run test:regression`: **98 passed**, no skips; includes `npm run build` / TypeScript.
- Frontend `node --test "tests/regression/*.test.cjs"`: **51 passed**, no skips.
- Backend `npm run test:integration` with loopback TEST_DATABASE_URL: **9 passed**, no skips (includes parent/subtests).
- Backend `npm run test:promotion-apply`: **19 passed**.
- Frontend `npm run build`: passed with TypeScript and 57 generated routes.
- `git diff --check`: passed. No migration required by these edits and no migration executed against production.
- Existing Browserslist-age warnings and styled-jsx attributes in the SSR test harness remain; neither disables TypeScript or fails builds.

## Pending access and policy

Asked for a TEST customer that can receive OTP and TEST staff/admin browser logins. No credentials are included here. End-to-end production results remain unverified until those steps actually run. Ordinary-boat handout and review moderation should be decided as feature scope, not silently introduced. Minimal local DB fixtures do not prove all production triggers, migrations, catalog data, or every race are correct.

## Changed files

- `backend/src/controllers/booking.controller.ts`
- `backend/src/controllers/payment.controller.ts`
- `backend/src/middleware/image-upload.middleware.ts`
- `backend/src/middleware/validators.ts`
- `backend/tests/integration/README.md`
- `backend/tests/integration/auth-reset.test.cjs`
- `backend/tests/integration/booking-capacity.test.cjs`
- `backend/tests/integration/promotion-wallet.test.cjs`
- `backend/tests/integration/review-ownership.test.cjs`
- `backend/tests/integration/room-status-concurrency.test.cjs`
- `backend/tests/regression/booking-controller-guards.test.cjs`
- `backend/tests/regression/image-upload.test.cjs`
- `frontend/src/app/admin/calendar/page.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/admin/rooms/page.tsx`
- `frontend/src/app/booking/details/page.tsx`
- `frontend/src/app/kayaks/page.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/payment/page.tsx`
- `frontend/src/app/rooms/[id]/page.tsx`
- `frontend/src/app/rooms/page.tsx`
- `frontend/src/components/booking/RoomCartPanel.tsx`
- `frontend/src/components/layout/Footer.tsx`
- `frontend/src/lib/date.ts`
- `frontend/src/lib/payment-slip.ts`
- `frontend/src/lib/resort-info.ts`
- `frontend/src/lib/room-cart.ts`
- `frontend/tests/regression/boat-entitlement-ux.test.cjs`
- `frontend/tests/regression/customer-booking.test.cjs`
