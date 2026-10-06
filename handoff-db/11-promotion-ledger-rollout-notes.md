# Promotion ledger repair: 2026-10-05

## Reviewed decisions

The production read-only inventory found 14 room-promotion pairs missing from `booking_promotions`: paid 6, approved 2, checked_out 1, cancelled 3, rejected 2. The 9 active/completed uses and the 2 rejected uses will be inserted: 11 ledger rows in total. Aggregate source rows by booking + promotion and preserve the summed discount and earliest source timestamp.

The user explicitly asked to keep the quota for rejected pairs `(83,10)` and `(89,17)` because their prior status is unknown. Their non-null `approved_by_staff_id` cannot prove a previous approval: the rejection controller also sets that column.

Reviewed cancelled source pairs `(82,10)`, `(87,16)`, `(90,17)` and cancelled header-only pairs `(39,6)`, `(40,12)`, `(92,19)`, `(93,20)` have no approval staff recorded and are classified as released for this specific repair. No ledger rows will be inserted for these seven pairs. Their promotions are included in the quota reconciliation. The script rechecks the reviewed status, absent approval staff, and absent ledger. It does not apply this classification automatically to any other cancelled/rejected booking.

All existing ledger rows, including terminal bookings, remain unchanged. Other missing terminal or header-only usages stop the repair. `usage_count` is recalculated from the full room and boat ledger for affected promotions, without clamping historical counts to current limits. Existing wallets are recalculated from per-member ledger counts: unlimited limits remain saved, finite caps produce used when reached, expired wallets remain unchanged. A new ledger row links to an existing wallet only when the wallet was already saved at the original usage timestamp. No wallets are synthesized.

The reviewed inventory includes promotion 12 with a current global cap of 1 and 2 retained uses. Preserve that historical count of 2; the preview reports it as above the current cap.

## Execution record

- Backup branch `codex-pr21-fixes-20261005` (`br-icy-moon-ao8wvq7z`), project `quiet-king-04010039`, database `neondb`: applied at 2026-10-05 15:00:37 UTC. The branch remains available.
- Production branch `br-frosty-forest-aoqj9oeb`: applied once at 2026-10-06 03:18:06 UTC after the backup verification passed.
- Both targets used preview fingerprint `8196b804ea6b27b3d210b87b978dcae1`, with 14 candidates, 11 inserts, 3 source releases, 4 header-only releases and no exceptions.
- File 10 passed on both targets: one run marker, `inserted_matches_preview=true`, every violation count zero. Quotas for bookings 83 and 89 remain retained.
- A repeat application on the backup was refused with `Already committed once; refusing to apply again`.
- The guest-policy migration was tested on the backup and applied to production. The initial cutoff remains 6. Production has `approved_by_staff_id`, not `verify_by_staff_id`; controllers use the existing approval column.
- All 11 representative pagination SQL queries parsed and produced PostgreSQL execution plans on the backup in a read-only transaction.
- Files 08, 09 and 10 all set transaction-local UTC. This keeps timestamp JSON in fingerprints and audit comparisons independent of the SQL editor's default timezone.
- Backup preview: expect 14 candidates, 11 inserts, 3 source releases, 4 header-only releases, and no exceptions. Review every counter delta.
- Backup apply: set `apply=true` and its current preview fingerprint in file 09; run the complete transaction.
- Backup verification: file 10 must report one run marker, inserted_matches_preview=true, and all violation counts zero.
- Repeat attempt: file 09 must refuse another application through the committed marker. Verify the first marker and ledger counts remain unchanged.
- Production: use a short booking-write maintenance window, execute the SELECT-only preview again, review its fingerprint and totals, apply once with that fingerprint, and immediately verify. Keep the backup branch available.

The one-off audit marker records the reviewed plan and before snapshots of affected counters, wallets and existing ledger, plus the inserted ledger rows. Any later rollback must account for legitimate bookings or cancellations after application; never overwrite a live database blindly with those snapshots. Once normal traffic resumes, pending/paid cancellation may legitimately remove an inserted ledger row and reduce its quota.

If a guard or lock timeout aborts the transaction and the SQL editor keeps that session open, issue `ROLLBACK` to clear the failed transaction before running another preview. Do not remove a guard to retry.
