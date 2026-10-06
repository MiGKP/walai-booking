-- Apply ONLY after file 08 has been inspected, tested on the backup Neon branch,
-- and file 10 has passed there. Re-preview production immediately before applying.
-- No ledger rows are deleted. No wallets are created. All existing usages are retained.
-- Fill expected_fingerprint from file 08 ON THE CURRENT TARGET DATABASE and set apply=true.
-- The same run_key is deliberately refused after one committed application.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(20261005,902);
DO $$ BEGIN
  IF to_regclass('public.promotion_backfill_runs') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.promotion_backfill_runs
               WHERE run_key='2026-10-05-room-promotion-ledger-v1') THEN
      RAISE EXCEPTION 'Already committed once; refusing to apply again';
    END IF;
  END IF;
END $$;
LOCK TABLE public.room_bookings,public.boat_bookings,public.booking_room_promotions,
           public.booking_promotions,public.promotions,public.member_promotions
  IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE backfill_settings ON COMMIT DROP AS
SELECT false AS apply, 'REPLACE_WITH_CURRENT_TARGET_PREVIEW_FINGERPRINT'::text AS expected_fingerprint;
CREATE TEMP TABLE backfill_plan ON COMMIT DROP AS
WITH decisions(room_booking_id,promotion_id,decision,expected_status,reason) AS (
  VALUES (82,10,'release','cancelled','reviewed cancelled; approval staff absent'),
         (87,16,'release','cancelled','reviewed cancelled; approval staff absent'),
         (90,17,'release','cancelled','reviewed cancelled; approval staff absent'),
         (83,10,'retain','rejected','user explicitly retained quota; prior status unknown'),
         (89,17,'retain','rejected','user explicitly retained quota; prior status unknown'),
         (39,6,'release','cancelled','reviewed header-only cancelled; approval staff absent'),
         (40,12,'release','cancelled','reviewed header-only cancelled; approval staff absent'),
         (92,19,'release','cancelled','reviewed header-only cancelled; approval staff absent'),
         (93,20,'release','cancelled','reviewed header-only cancelled; approval staff absent')
), grouped AS (
  SELECT brp.room_booking_id,brp.promotion_id,rb.member_id,rb.status,rb.approved_by_staff_id,
         SUM(brp.discount_amount) AS discount_amount,MIN(brp.created_at) AS created_at,
         COUNT(*) AS source_lines
  FROM public.booking_room_promotions brp JOIN public.room_bookings rb USING (room_booking_id)
  GROUP BY brp.room_booking_id,brp.promotion_id,rb.member_id,rb.status,rb.approved_by_staff_id
), sources AS (
  SELECT g.*,bp.booking_promotion_id,
         CASE WHEN d.decision IS NOT NULL THEN d.decision
              WHEN g.status IN ('pending','paid','approved','checked_out') THEN 'retain'
              WHEN g.status IN ('cancelled','rejected') AND bp.booking_promotion_id IS NOT NULL THEN 'retain'
              ELSE NULL END AS decision,
         COALESCE(d.reason,CASE WHEN bp.booking_promotion_id IS NOT NULL
                    THEN 'preserve existing ledger' ELSE 'active or completed usage' END) AS reason,
         mp.member_promotion_id
  FROM grouped g LEFT JOIN decisions d USING (room_booking_id,promotion_id)
  LEFT JOIN public.booking_promotions bp
    ON bp.room_booking_id=g.room_booking_id AND bp.promotion_id=g.promotion_id
  LEFT JOIN public.member_promotions mp
    ON mp.member_id=g.member_id AND mp.promotion_id=g.promotion_id AND mp.saved_at <= g.created_at
), headers AS (
  SELECT rb.room_booking_id,rb.promotion_id,rb.member_id,rb.status,rb.approved_by_staff_id,
         d.decision,d.reason
  FROM public.room_bookings rb LEFT JOIN decisions d
    ON d.room_booking_id=rb.room_booking_id AND d.promotion_id=rb.promotion_id
  WHERE rb.promotion_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM grouped g WHERE
      g.room_booking_id=rb.room_booking_id AND g.promotion_id=rb.promotion_id)
    AND NOT EXISTS (SELECT 1 FROM public.booking_promotions bp WHERE
      bp.room_booking_id=rb.room_booking_id AND bp.promotion_id=rb.promotion_id)
), affected AS (
  SELECT promotion_id FROM grouped UNION SELECT promotion_id FROM headers
), changes AS (
  SELECT p.id AS promotion_id,p.usage_count AS before_count,p.usage_limit,p.usage_limit_per_member,
         (SELECT COUNT(*)::integer FROM public.booking_promotions bp WHERE bp.promotion_id=p.id) AS existing_count,
         (SELECT COUNT(*)::integer FROM sources s WHERE s.promotion_id=p.id
           AND s.decision='retain' AND s.booking_promotion_id IS NULL) AS inserts
  FROM public.promotions p JOIN affected a ON a.promotion_id=p.id
), counters AS (
  SELECT c.*,existing_count+inserts AS after_count,
         existing_count+inserts-before_count AS delta FROM changes c
), projected_wallets AS (
  SELECT mp.member_promotion_id,mp.status AS before_status,
         CASE WHEN mp.status='expired' THEN 'expired'
              WHEN p.usage_limit_per_member IS NOT NULL AND
                (SELECT COUNT(*) FROM public.booking_promotions bp
                 WHERE bp.member_id=mp.member_id AND bp.promotion_id=mp.promotion_id) +
                (SELECT COUNT(*) FROM sources s WHERE s.member_id=mp.member_id AND s.promotion_id=mp.promotion_id
                 AND s.booking_promotion_id IS NULL AND s.decision='retain') >= p.usage_limit_per_member
                THEN 'used' ELSE 'saved' END AS after_status
  FROM public.member_promotions mp JOIN affected a USING (promotion_id)
  JOIN public.promotions p ON p.id=mp.promotion_id
), wallet_transitions AS (
  SELECT before_status,after_status,COUNT(*) AS wallets FROM projected_wallets
  GROUP BY before_status,after_status
), exceptions AS (
  SELECT 'unresolved_source' AS code,s.room_booking_id,s.promotion_id
    FROM sources s WHERE s.decision IS NULL
  UNION ALL
  SELECT 'unreviewed_header_only',h.room_booking_id,h.promotion_id FROM headers h
    WHERE h.decision IS DISTINCT FROM 'release'
  UNION ALL
  SELECT 'decision_missing_or_changed',d.room_booking_id,d.promotion_id FROM decisions d
    LEFT JOIN public.room_bookings rb ON rb.room_booking_id=d.room_booking_id
    WHERE rb.promotion_id IS DISTINCT FROM d.promotion_id
      AND NOT EXISTS (SELECT 1 FROM grouped g WHERE
        g.room_booking_id=d.room_booking_id AND g.promotion_id=d.promotion_id)
  UNION ALL
  SELECT 'decision_status_changed',d.room_booking_id,d.promotion_id FROM decisions d
    LEFT JOIN public.room_bookings rb ON rb.room_booking_id=d.room_booking_id
    WHERE rb.status IS DISTINCT FROM d.expected_status
       OR (d.decision='release' AND rb.approved_by_staff_id IS NOT NULL)
  UNION ALL
  SELECT 'release_has_existing_ledger',d.room_booking_id,d.promotion_id FROM decisions d
    JOIN public.booking_promotions bp ON bp.room_booking_id=d.room_booking_id AND bp.promotion_id=d.promotion_id
    WHERE d.decision='release'
  UNION ALL
  SELECT 'invalid_member_or_snapshot',s.room_booking_id,s.promotion_id FROM sources s
    LEFT JOIN public.members m ON m.member_id=s.member_id
    WHERE (s.decision='retain' AND m.member_id IS NULL) OR s.created_at IS NULL
      OR s.discount_amount < 0 OR s.discount_amount::text IN ('NaN','Infinity','-Infinity')
  UNION ALL
  SELECT 'existing_ledger_conflict',s.room_booking_id,s.promotion_id FROM sources s
    JOIN public.booking_promotions bp ON bp.booking_promotion_id=s.booking_promotion_id
    WHERE bp.member_id IS DISTINCT FROM s.member_id OR bp.discount_amount IS DISTINCT FROM s.discount_amount
  UNION ALL
  SELECT 'wallet_link_conflict',bp.room_booking_id,bp.promotion_id FROM public.booking_promotions bp
    JOIN affected a USING (promotion_id)
    JOIN public.member_promotions mp ON mp.member_promotion_id=bp.member_promotion_id
    WHERE bp.member_id IS DISTINCT FROM mp.member_id OR bp.promotion_id IS DISTINCT FROM mp.promotion_id
), fingerprint_parts AS (
  SELECT 'source' AS kind,brp.id::text AS item,
    jsonb_build_object('line',to_jsonb(brp),'member_id',rb.member_id,'status',rb.status,
                      'staff',rb.approved_by_staff_id) AS value
    FROM public.booking_room_promotions brp JOIN public.room_bookings rb USING (room_booking_id)
  UNION ALL SELECT 'decision',d.room_booking_id::text||'/'||d.promotion_id::text,to_jsonb(d) FROM decisions d
  UNION ALL SELECT 'header',h.room_booking_id::text,to_jsonb(h) FROM headers h
  UNION ALL SELECT 'ledger',bp.booking_promotion_id::text,to_jsonb(bp)
    FROM public.booking_promotions bp JOIN affected a USING (promotion_id)
  UNION ALL SELECT 'wallet',mp.member_promotion_id::text,to_jsonb(mp)
    FROM public.member_promotions mp JOIN affected a USING (promotion_id)
  UNION ALL SELECT 'promotion',p.id::text,jsonb_build_object('id',p.id,'usage_count',p.usage_count,
    'usage_limit',p.usage_limit,'usage_limit_per_member',p.usage_limit_per_member,'is_collectible',p.is_collectible)
    FROM public.promotions p JOIN affected a ON a.promotion_id=p.id
), fingerprint AS (
  SELECT md5(COALESCE(string_agg(kind||':'||item||':'||value::text,E'\n' ORDER BY kind,item),'empty')) AS value
  FROM fingerprint_parts
)
SELECT jsonb_build_object(
  'run_key','2026-10-05-room-promotion-ledger-v1',
  'database',current_database(),
  'fingerprint',(SELECT value FROM fingerprint),
  'audit_table_exists',to_regclass('public.promotion_backfill_runs') IS NOT NULL,
  'candidate_count',(SELECT COUNT(*) FROM sources WHERE booking_promotion_id IS NULL),
  'insert_count',(SELECT COUNT(*) FROM sources WHERE booking_promotion_id IS NULL AND decision='retain'),
  'source_release_count',(SELECT COUNT(*) FROM sources WHERE booking_promotion_id IS NULL AND decision='release'),
  'header_only_count',(SELECT COUNT(*) FROM headers),
  'candidates',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
     'booking',s.room_booking_id,'promotion',s.promotion_id,'status',s.status,'decision',s.decision,
     'discount',s.discount_amount,'lines',s.source_lines,'reason',s.reason)
     ORDER BY s.room_booking_id,s.promotion_id),'[]'::jsonb) FROM sources s WHERE s.booking_promotion_id IS NULL),
  'header_only',(SELECT COALESCE(jsonb_agg(jsonb_build_object('booking',h.room_booking_id,
    'promotion',h.promotion_id,'status',h.status,'decision',h.decision) ORDER BY h.room_booking_id),'[]'::jsonb) FROM headers h),
  'counters',(SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.promotion_id),'[]'::jsonb) FROM counters c),
  'wallet_transitions',(SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.before_status,w.after_status),'[]'::jsonb) FROM wallet_transitions w),
  'exceptions',(SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.code,e.room_booking_id,e.promotion_id),'[]'::jsonb) FROM exceptions e),
  'over_global_limit',(SELECT COALESCE(jsonb_agg(c.promotion_id ORDER BY c.promotion_id),'[]'::jsonb)
     FROM counters c WHERE c.usage_limit IS NOT NULL AND c.after_count>c.usage_limit)
) AS plan;
DO $$ BEGIN
  IF NOT (SELECT apply FROM backfill_settings) THEN
    RAISE EXCEPTION 'Set apply=true only after successful backup-branch rehearsal';
  END IF;
  IF (SELECT plan->'exceptions' FROM backfill_plan) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Backfill exceptions: %',(SELECT plan->'exceptions' FROM backfill_plan);
  END IF;
  IF (SELECT expected_fingerprint FROM backfill_settings) IS DISTINCT FROM
     (SELECT plan->>'fingerprint' FROM backfill_plan) THEN
    RAISE EXCEPTION 'Target changed or wrong preview fingerprint; re-preview and review';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.promotion_backfill_runs (
  run_key text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now(),report jsonb NOT NULL
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.promotion_backfill_runs
             WHERE run_key='2026-10-05-room-promotion-ledger-v1') THEN
    RAISE EXCEPTION 'Already committed once; refusing to apply again';
  END IF;
END $$;
CREATE TEMP TABLE affected_promotions ON COMMIT DROP AS
SELECT (item->>'promotion_id')::integer AS promotion_id
FROM backfill_plan bp CROSS JOIN LATERAL jsonb_array_elements(bp.plan->'counters') item;
CREATE TEMP TABLE before_promotions ON COMMIT DROP AS
SELECT p.id,p.usage_count,p.updated_at FROM public.promotions p
JOIN affected_promotions a ON a.promotion_id=p.id;
CREATE TEMP TABLE before_wallets ON COMMIT DROP AS
SELECT mp.* FROM public.member_promotions mp JOIN affected_promotions a USING (promotion_id);
CREATE TEMP TABLE before_ledger ON COMMIT DROP AS
SELECT bp.* FROM public.booking_promotions bp JOIN affected_promotions a USING (promotion_id);
CREATE TEMP TABLE retained_missing ON COMMIT DROP AS
SELECT (item->>'booking')::integer AS room_booking_id,(item->>'promotion')::integer AS promotion_id
FROM backfill_plan bp CROSS JOIN LATERAL jsonb_array_elements(bp.plan->'candidates') item
WHERE item->>'decision'='retain';
CREATE TEMP TABLE inserted_ledger ON COMMIT DROP AS
WITH inserted AS (
  INSERT INTO public.booking_promotions
    (promotion_id,member_id,member_promotion_id,room_booking_id,boat_booking_id,discount_amount,created_at)
  SELECT g.promotion_id,g.member_id,mp.member_promotion_id,g.room_booking_id,NULL,g.discount_amount,g.created_at
  FROM (
    SELECT brp.room_booking_id,brp.promotion_id,rb.member_id,
           SUM(brp.discount_amount) AS discount_amount,MIN(brp.created_at) AS created_at
    FROM public.booking_room_promotions brp JOIN retained_missing r USING (room_booking_id,promotion_id)
    JOIN public.room_bookings rb USING (room_booking_id)
    GROUP BY brp.room_booking_id,brp.promotion_id,rb.member_id
  ) g LEFT JOIN public.member_promotions mp
    ON mp.member_id=g.member_id AND mp.promotion_id=g.promotion_id AND mp.saved_at<=g.created_at
  ON CONFLICT (room_booking_id,promotion_id) WHERE room_booking_id IS NOT NULL DO NOTHING
  RETURNING *
) SELECT * FROM inserted;
-- Count BOTH room and boat ledger, including approved/completed and retained historical terminals.
UPDATE public.promotions p SET usage_count=c.used_count,updated_at=now()
FROM (SELECT a.promotion_id,COUNT(bp.booking_promotion_id)::integer AS used_count
      FROM affected_promotions a LEFT JOIN public.booking_promotions bp USING (promotion_id)
      GROUP BY a.promotion_id) c
WHERE p.id=c.promotion_id AND p.usage_count IS DISTINCT FROM c.used_count;
WITH wallet_counts AS (
  SELECT mp.member_promotion_id,p.usage_limit_per_member,COUNT(bp.booking_promotion_id)::integer AS used_count,
         MAX(bp.created_at) AS last_use
  FROM public.member_promotions mp JOIN affected_promotions a USING (promotion_id)
  JOIN public.promotions p ON p.id=mp.promotion_id
  LEFT JOIN public.booking_promotions bp ON bp.member_id=mp.member_id AND bp.promotion_id=mp.promotion_id
  GROUP BY mp.member_promotion_id,p.usage_limit_per_member
), targets AS (
  SELECT wc.*,CASE WHEN usage_limit_per_member IS NOT NULL AND used_count>=usage_limit_per_member
                  THEN 'used' ELSE 'saved' END AS next_status FROM wallet_counts wc
)
UPDATE public.member_promotions mp
SET status=t.next_status,
    used_at=CASE WHEN t.next_status='saved' THEN NULL ELSE COALESCE(mp.used_at,t.last_use) END
FROM targets t WHERE mp.member_promotion_id=t.member_promotion_id AND mp.status<>'expired'
 AND (mp.status IS DISTINCT FROM t.next_status OR
      (t.next_status='saved' AND mp.used_at IS NOT NULL) OR
      (t.next_status='used' AND mp.used_at IS NULL));
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM inserted_ledger) IS DISTINCT FROM
     (SELECT (plan->>'insert_count')::bigint FROM backfill_plan) THEN
    RAISE EXCEPTION 'Inserted count differs from reviewed preview';
  END IF;
  IF EXISTS (SELECT 1 FROM before_ledger b LEFT JOIN public.booking_promotions bp USING (booking_promotion_id)
             WHERE bp.booking_promotion_id IS NULL OR to_jsonb(bp) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Existing ledger row changed or disappeared';
  END IF;
  IF EXISTS (SELECT 1 FROM before_wallets b JOIN public.member_promotions mp USING (member_promotion_id)
             WHERE b.status='expired' AND to_jsonb(mp) IS DISTINCT FROM to_jsonb(b)) THEN
    RAISE EXCEPTION 'Expired wallet changed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.promotions p JOIN affected_promotions a ON a.promotion_id=p.id
             WHERE p.usage_count IS DISTINCT FROM (SELECT COUNT(*)::integer FROM public.booking_promotions bp
                                                  WHERE bp.promotion_id=p.id)) THEN
    RAISE EXCEPTION 'Global count disagrees with full ledger';
  END IF;
  IF EXISTS (SELECT 1 FROM public.member_promotions mp JOIN affected_promotions a USING (promotion_id)
             JOIN public.promotions p ON p.id=mp.promotion_id
             WHERE mp.status<>'expired' AND (mp.status IS DISTINCT FROM
               CASE WHEN p.usage_limit_per_member IS NOT NULL AND
                  (SELECT COUNT(*) FROM public.booking_promotions bp
                   WHERE bp.member_id=mp.member_id AND bp.promotion_id=mp.promotion_id)>=p.usage_limit_per_member
                THEN 'used' ELSE 'saved' END OR (mp.status='saved' AND mp.used_at IS NOT NULL))) THEN
    RAISE EXCEPTION 'Wallet count/status mismatch';
  END IF;
END $$;
INSERT INTO public.promotion_backfill_runs(run_key,report)
SELECT '2026-10-05-room-promotion-ledger-v1',jsonb_build_object(
  'plan',b.plan,
  'promotions_before',(SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM before_promotions p),
  'wallets_before',(SELECT COALESCE(jsonb_agg(to_jsonb(w)),'[]'::jsonb) FROM before_wallets w),
  'ledger_before',(SELECT COALESCE(jsonb_agg(to_jsonb(bp)),'[]'::jsonb) FROM before_ledger bp),
  'inserted_ledger',(SELECT COALESCE(jsonb_agg(to_jsonb(bp)),'[]'::jsonb) FROM inserted_ledger bp)
) FROM backfill_plan b;
COMMIT;
-- SELECT result AFTER COMMIT confirms this marker was persisted, not only staged.
SELECT jsonb_build_object('run_key',run_key,'applied_at',applied_at,
  'inserted',(report->'plan'->>'insert_count')::integer,
  'fingerprint',report->'plan'->>'fingerprint') AS applied
FROM public.promotion_backfill_runs WHERE run_key='2026-10-05-room-promotion-ledger-v1';
