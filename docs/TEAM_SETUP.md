# Owner setup: team sync + free Vercel deploys

Do these steps once on your GitHub and Vercel accounts.

## 1. GitHub collaborators

1. Open https://github.com/MiGKP/walai-booking/settings/access
2. Add each friend with **Write** permission
3. They must accept the invite

Until the GitHub account flag is cleared, outsiders may still see 404. Collaborators who already accepted can usually access while logged in.

## 2. Work on main

Default branch should stay `main`:

1. GitHub → Settings → General → Default branch → `main`
2. Locally:

```bash
git checkout main
git pull origin main
```

Tell teammates to use the same commands every day before coding.

## 3. Vercel token for GitHub Actions (no Pro)

### Create token

1. https://vercel.com/account/tokens
2. Create token → copy value

### Get org and project ids

On your machine (already logged into Vercel CLI):

```bash
cd frontend
npx vercel login
npx vercel link
```

Open `frontend/.vercel/project.json` and copy:

- `orgId` → `VERCEL_ORG_ID`
- `projectId` → `VERCEL_PROJECT_ID`

Do not commit the `.vercel/` folder.

### Add GitHub secrets

1. https://github.com/MiGKP/walai-booking/settings/secrets/actions
2. Add:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

### Avoid double deploys

Vercel project → Settings → Git:

- Disable automatic production deployments from Git, **or**
- Keep Git connected but rely on Actions only for production

## 4. Verify

1. Merge or push a tiny change under `frontend/` to `main`
2. Open GitHub → Actions → “Deploy frontend to Vercel”
3. Confirm the run succeeds and the Vercel production URL updates

## Why this works on Hobby

Hobby refuses collaborator Git deploys on private repos. Actions deploys with **your** token, so friend commits that reach `main` still go live without Vercel Pro.
