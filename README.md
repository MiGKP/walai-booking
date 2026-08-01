# Walai Booking

Full-stack booking system for Walai Floating Resort (สวนวลัยรุกขเวช), covering floating room stays and kayak sessions.

**Stack:** Next.js (App Router) · Express.js (TypeScript) · PostgreSQL

---

## Features

### Customer
- Browse and book rooms by date range with calendar availability
- Book kayaks by date and time round, with live capacity checks
- Apply promotion codes (percent or fixed amount)
- Pay via PromptPay QR or bank transfer and upload a payment slip
- Receive booking and payment status emails
- View booking history and submit reviews after stay

### Staff
- Room staff: review slips, approve or reject room bookings, check out guests
- Boat staff: review slips, confirm kayak rounds, record boat returns
- Operator name is recorded on each payment decision

### Admin
- Revenue and booking statistics
- Manage staff accounts and roles
- Manage room types, amenities, images, and individual rooms
- Manage kayak types, inventory, rounds, and operating hours
- Manage promotions, members, reviews, and resort contact or bank details

---

## Project structure

```text
walai_booking/
├── frontend/                 # Next.js application
│   └── src/
│       ├── app/              # Routes (admin, auth, dashboard, rooms, kayaks, staff)
│       ├── components/       # Shared UI and 3D scenes
│       ├── hooks/            # Auth hooks
│       └── lib/              # API client and helpers
├── backend/                  # Express API
│   └── src/
│       ├── config/           # Database and Passport
│       ├── controllers/      # Request handlers
│       ├── middleware/       # Auth, validation, uploads
│       ├── routes/           # /api routes
│       ├── services/         # Mail, Cloudinary, cron jobs
│       └── index.ts
├── docs/                     # Design notes and plans
└── README.md
```

---

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer
- npm

---

## Environment configuration

Do not commit real secrets. Copy the examples below into local env files only.

### Backend — `backend/.env`

```env
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/walai

# Auth
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
SESSION_SECRET=replace_with_another_long_random_string

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Frontend origin (CORS / redirects)
FRONTEND_URL=http://localhost:3000

# Cloudinary (required for uploads in production)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Fallback payment display values (prefer values stored in resort_info via admin)
PROMPTPAY_ID=
BANK_ACCOUNT_NUMBER=
BANK_ACCOUNT_NAME=

# Email via Brevo HTTPS API
MAIL_PROVIDER=brevo
BREVO_API_KEY=
MAIL_FROM="Walai Booking <verified_sender@example.com>"
APP_NAME=Walai Booking
PASSWORD_RESET_EXPIRES_MINUTES=30
```

Notes:
- Set `CLOUDINARY_*` only in `backend/.env` and the hosting provider environment.
- Never put Cloudinary secrets or mail API keys in the frontend.
- New media is uploaded to Cloudinary. Legacy `/uploads/...` paths may still resolve in local development.

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## Setup

### 1. Database

1. Create a PostgreSQL database named `walai`.
2. Point `DATABASE_URL` in `backend/.env` at that database.
3. Apply your project schema / migrations as used by the team.

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

API default: `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App default: `http://localhost:3000`

---

## Main database tables

| Table | Purpose |
| --- | --- |
| `members` | Customer accounts |
| `staff` | Staff and admin accounts (`admin`, `room_staff`, `boat_staff`) |
| `room_types`, `rooms` | Room catalog and physical units |
| `room_bookings` | Room reservations |
| `boat_types`, `boat_rounds`, `boat_bookings` | Kayak catalog, rounds, and reservations |
| `promotions` | Discount codes |
| `resort_info` | Contact and payment display settings |

### Important triggers

1. **`calculate_booking_price`** — computes room booking totals from nightly rate, nights, and promotion.
2. **`update_room_status_on_booking`** — sets room status to occupied when approved, and back to available on cancel, reject, or check-out.

---

## Roles

| Role | Access |
| --- | --- |
| `customer` | Book rooms and kayaks, pay, upload slips, view own history, write reviews |
| `room_staff` | Room booking dashboard, slip review, approve or reject, check-out |
| `boat_staff` | Kayak booking dashboard, slip review, approve or reject, boat return |
| `admin` | Full system access, staff, catalog, promotions, statistics, site settings |

---

## Collaboration and deployment

Production branch is `main`.

- Teammates need GitHub **Write** access on this repository.
- Keep local copies updated with `git pull origin main`.
- Prefer short feature branches and pull requests into `main`.
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

### Frontend (Vercel) without Pro

Vercel Hobby blocks automatic Git deploys from collaborators on private repositories. This project deploys the frontend with GitHub Actions instead, using the owner’s Vercel token.

Required GitHub Actions secrets:

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` in `frontend/` |
| `VERCEL_PROJECT_ID` | same file |

Workflow file: `.github/workflows/deploy-frontend.yml`

After secrets are set, any push to `main` that changes `frontend/**` deploys production.

In the Vercel project, turn off automatic Git deployments for Production so owner pushes are not deployed twice (Actions already deploys). Keep the Git connection for project metadata if needed.

### Backend

Point your API host (for example Render) at the same GitHub repository and deploy branch `main`, so backend changes also publish when `main` updates.

---

## Security notes

- Keep `.env` files out of version control.
- Do not commit files under `backend/uploads/` (payment slips, avatars, local images).
- Rotate any secret that was previously shared in documentation or chat.
- Prefer long random values for `JWT_SECRET` and `SESSION_SECRET` in every environment.

---

## License

Prepared for the Walai Floating Resort booking project (สวนวลัยรุกขเวช).
