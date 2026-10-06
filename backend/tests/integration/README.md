# Local PostgreSQL regression checks

`room-status-concurrency.test.cjs` calls the real booking controllers against PostgreSQL. It checks cancellation during check-in and concurrent checkout of the last two rooms.

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
