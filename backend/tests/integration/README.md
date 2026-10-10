# Local PostgreSQL regression checks

`room-status-concurrency.test.cjs` calls the real booking controllers against PostgreSQL. It checks cancellation during check-in and concurrent checkout of the last two rooms.

`promotion-wallet.test.cjs` exercises collected coupon use and quota restoration for both room and boat bookings with the production `varchar` wallet status type. Its temporary tables and writes are rolled back.

`booking-capacity.test.cjs` sends five concurrent requests for one physical room and five for the final boat. It checks both the HTTP result and persisted headers/lines using the real controllers and row locks.

`auth-reset.test.cjs` uses real bcrypt and PostgreSQL to check replacement OTPs, one-time reset, old/new passwords and old/new JWTs. Email is captured in process; this does not test delivery. Its temporary tables run outside a long transaction so PostgreSQL `NOW()` measures the reset time correctly.

`review-ownership.test.cjs` checks completed-stay ownership, wrong room types, simultaneous duplicate reviews, and owner-only edits/deletes against temporary tables with the unique constraint. The expected duplicate writes produce a controller error log and a 409 response.

These fixtures are minimal and do not recreate every production migration or trigger. Passing this suite is local controller/transaction evidence, not production end-to-end evidence.

Use a separate local PostgreSQL server or test database. The role needs permission to create a schema. The suite creates a random schema, inserts minimal fixtures, and removes that schema after the run. It does not load the backend `.env` or send mail.

From PowerShell in `backend/`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test_user@127.0.0.1:55439/test_db'
npm run test:integration
Remove-Item Env:TEST_DATABASE_URL
```

The suite rejects non-local hosts and skips when `TEST_DATABASE_URL` is absent. A skip is not a successful concurrency check.

Other relevant checks:

```powershell
npm run test:regression
npm run test:promotion-apply
```

Run the frontend regression suite from `frontend/` with `node --test "tests/regression/*.test.cjs"`, then run `npm run build` in both packages.
