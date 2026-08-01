# Contributing to Walai Booking

This repository uses `main` as the only production branch. Frontend production deploys run through GitHub Actions so collaborators can ship without a Vercel Pro plan.

## Access

1. The repo owner adds each teammate as a GitHub collaborator with **Write** access.
2. Teammates accept the invitation from GitHub email or notifications.
3. Clone the repository and work from `main`:

```bash
git clone https://github.com/MiGKP/walai-booking.git
cd walai_booking
git checkout main
git pull origin main
```

## Daily sync

Before starting work, always update local `main`:

```bash
git checkout main
git pull origin main
```

After pushing, teammates should pull again so everyone’s copy stays aligned.

## Branch workflow

Preferred flow for shared work:

1. Update `main`
2. Create a short-lived branch for the change
3. Commit and push the branch
4. Open a pull request into `main`
5. After merge, everyone runs `git pull origin main`

Small solo fixes may be committed directly to `main` if the team agrees. Avoid long-lived personal branches that diverge for days.

```bash
git checkout main
git pull origin main
git checkout -b fix/short-description
# ... make changes ...
git add .
git commit -m "fix: short description"
git push -u origin HEAD
```

Then open a pull request targeting `main`.

## What deploys where

| Change area | Host | Trigger |
| --- | --- | --- |
| `frontend/**` on `main` | Vercel | GitHub Actions workflow `Deploy frontend to Vercel` |
| `backend/**` on the connected branch | Render (or your API host) | Git auto-deploy on that host |

Vercel Hobby blocks collaborator Git deploys on private repos. This project deploys through Actions using the owner’s Vercel token instead, so friend pushes that land on `main` still go live.

## Local setup

Backend:

```bash
cd backend
cp .env.example .env
# fill secrets locally — never commit .env
npm install
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.local.example .env.local   # create if missing
# NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm install
npm run dev
```

## Security

- Do not commit `.env`, `.env.local`, payment slips, or files under `backend/uploads/`
- Use placeholders from `backend/.env.example`
- If a secret was shared by mistake, rotate it immediately
