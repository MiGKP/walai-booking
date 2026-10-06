-- SELECT-only post-commit verification. Run only after the audit table exists (file 09).
-- Expected: inserted_matches_preview=true, and every *_violations value = 0.
-- All 7 explicitly released cancelled uses remain absent from the ledger.
BEGIN READ ONLY;
SET LOCAL TIME ZONE 'UTC';
WITH run AS (
  SELECT * FROM public.promotion_backfill_runs WHERE run_key='2026-10-05-room-promotion-ledger-v1'
), affected AS (
  SELECT (item->>'promotion_id')::integer AS promotion_id
  FROM run r CROSS JOIN LATERAL jsonb_array_elements(r.report->'plan'->'counters') item
), inserted AS (
  SELECT (item->>'booking_promotion_id')::integer AS booking_promotion_id,item AS snapshot
  FROM run r CROSS JOIN LATERAL jsonb_array_elements(r.report->'inserted_ledger') item
), old_ledger AS (
  SELECT (item->>'booking_promotion_id')::integer AS booking_promotion_id,item AS snapshot
  FROM run r CROSS JOIN LATERAL jsonb_array_elements(r.report->'ledger_before') item
), old_wallets AS (
  SELECT (item->>'member_promotion_id')::integer AS member_promotion_id,item AS snapshot
  FROM run r CROSS JOIN LATERAL jsonb_array_elements(r.report->'wallets_before') item
), released(room_booking_id,promotion_id) AS (
  VALUES (82,10),(87,16),(90,17),(39,6),(40,12),(92,19),(93,20)
), retained(room_booking_id,promotion_id) AS (VALUES (83,10),(89,17)), counters AS (
  SELECT p.id AS promotion_id,p.usage_count,
         (SELECT COUNT(*)::integer FROM public.booking_promotions bp WHERE bp.promotion_id=p.id) AS ledger_count
  FROM public.promotions p JOIN affected a ON a.promotion_id=p.id
), wallet_counts AS (
  SELECT mp.member_promotion_id,mp.status,mp.used_at,p.usage_limit_per_member,
         (SELECT COUNT(*) FROM public.booking_promotions bp
          WHERE bp.member_id=mp.member_id AND bp.promotion_id=mp.promotion_id) AS used_count
  FROM public.member_promotions mp JOIN affected a USING (promotion_id)
  JOIN public.promotions p ON p.id=mp.promotion_id
)
SELECT jsonb_build_object(
 'run_count',(SELECT COUNT(*) FROM run),
 'applied_at',(SELECT applied_at FROM run),
 'inserted_matches_preview',(SELECT COUNT(*) FROM inserted)=
      (SELECT (report->'plan'->>'insert_count')::bigint FROM run),
 'inserted_row_violations',(SELECT COUNT(*) FROM inserted i LEFT JOIN public.booking_promotions bp USING (booking_promotion_id)
       WHERE bp.booking_promotion_id IS NULL OR to_jsonb(bp) IS DISTINCT FROM i.snapshot),
 'old_ledger_violations',(SELECT COUNT(*) FROM old_ledger o LEFT JOIN public.booking_promotions bp USING (booking_promotion_id)
       WHERE bp.booking_promotion_id IS NULL OR to_jsonb(bp) IS DISTINCT FROM o.snapshot),
 'expired_wallet_violations',(SELECT COUNT(*) FROM old_wallets o LEFT JOIN public.member_promotions mp USING (member_promotion_id)
       WHERE o.snapshot->>'status'='expired' AND (mp.member_promotion_id IS NULL OR to_jsonb(mp) IS DISTINCT FROM o.snapshot)),
 'quota_violations',(SELECT COUNT(*) FROM counters WHERE usage_count IS DISTINCT FROM ledger_count),
 'wallet_violations',(SELECT COUNT(*) FROM wallet_counts WHERE status<>'expired' AND
       (status IS DISTINCT FROM CASE WHEN usage_limit_per_member IS NOT NULL AND used_count>=usage_limit_per_member
        THEN 'used' ELSE 'saved' END OR (status='saved' AND used_at IS NOT NULL))),
 'release_violations',(SELECT COUNT(*) FROM released r JOIN public.booking_promotions bp USING (room_booking_id,promotion_id)),
 'retained_rejection_violations',(SELECT COUNT(*) FROM retained r WHERE NOT EXISTS
       (SELECT 1 FROM public.booking_promotions bp WHERE bp.room_booking_id=r.room_booking_id AND bp.promotion_id=r.promotion_id)),
 'duplicate_room_promo_violations',(SELECT COUNT(*) FROM (
       SELECT bp.room_booking_id,bp.promotion_id FROM public.booking_promotions bp JOIN affected a USING (promotion_id)
       WHERE bp.room_booking_id IS NOT NULL GROUP BY bp.room_booking_id,bp.promotion_id HAVING COUNT(*)>1) duplicates),
 'counters',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.promotion_id),'[]'::jsonb) FROM counters c)
) AS verification;
-- Run immediately after application while booking writes remain paused. Later legitimate
-- cancellations can remove inserted pending/paid ledger rows; that is normal app behavior.
COMMIT;
