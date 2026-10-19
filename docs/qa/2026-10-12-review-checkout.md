# Review checkout eligibility and dashboard links

## Behavior

- A customer's approved or checked-out bill permits a review for a non-cancelled/non-rejected room type when the bill is checked out, a room of that type is checked out, or every remaining room is checked out.
- Cancelled/rejected room types never grant a review. Pending, paid, cancelled and rejected bills remain blocked. Ownership, room-type membership and duplicate protections remain in force.
- Booking cards support approved and checked-out bills and link to `/dashboard?tab=reviews`. Cancelled/rejected types are excluded when determining whether all types were reviewed.
- Reminder emails use the same dashboard URL. Reminder scheduling, completed-group selection and mail delivery rules are unchanged.
- `/reviews` redirects with HTTP **301** to the dashboard reviews tab. The duplicate standalone page is removed; the existing `MyReviewsSection` remains.

## Evidence

- Reproduced the old eligibility failure with real SQL on a separate local PostgreSQL instance before changing the controller.
- Targeted PostgreSQL integration: **13 tests passed, none skipped**, including the parent test, 11 status/room scenarios and the existing ownership/concurrent-duplicate test. Both listing and creation are exercised for every scenario, including mismatched types and foreign members.
- Backend build and regression: **136 passed**.
- Frontend regression: **75 passed**, including rendered approved/checked-out card links, terminal-status exclusion, already-reviewed badge and redirect configuration.
- Frontend production build passed with TypeScript checking enabled. Obsolete generated `.next/dev/types` referencing the deleted page was moved outside the repository; source checks were not disabled.
- Local production server returned HTTP **301** with `/dashboard?legacy=1&tab=reviews` for an old review URL with a query parameter.
- Reminder URL tests mock delivery; no emails were sent and no real customer booking was changed.

## Production verification

To be checked after deployment: Actions success for this commit, backend health/current deployment, legacy URL redirect and responsive dashboard reviews UI. Production mutations of customer reviews are outside these local tests.
