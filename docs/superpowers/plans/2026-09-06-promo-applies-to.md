# Promo applies-to implementation

Approved in spec `docs/superpowers/specs/2026-09-06-promo-applies-to-design.md`.

1. Migration `backend/src/db/migrations/2026-09-06-promo-applies-to.sql` — `applies_to` default `both`.
2. Apply math in `promotion-apply.ts`; checkout `scope` from validate + room/kayak create.
3. Admin create/edit dropdown; catalog/wallet hide mismatched use buttons.
4. Do not apply this SQL to Neon until asked.
