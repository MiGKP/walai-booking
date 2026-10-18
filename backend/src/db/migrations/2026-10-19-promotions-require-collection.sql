-- All promotions require wallet collection. Safe to re-run.
BEGIN;
ALTER TABLE promotions ALTER COLUMN is_collectible SET DEFAULT TRUE;
UPDATE promotions SET is_collectible = TRUE WHERE is_collectible IS NOT TRUE;
COMMIT;
