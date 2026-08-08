# AGENTS.md — Walai Booking

Instructions for AI coding agents and IDE assistants working in this repository.
Read this file before changing code. Prefer it over guesswork when project conventions conflict with generic defaults.

Human setup docs: [README.md](./README.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [docs/TEAM_SETUP.md](./docs/TEAM_SETUP.md).  
Design voice / brand: [.impeccable.md](./.impeccable.md).

---

## What this project is

Full-stack booking system for **Walai Floating Resort** (สวนวลัยรุกขเวช): floating room stays and kayak sessions, with PromptPay/bank-transfer slip payment, staff approval dashboards, and admin catalog management.

UI language is primarily **Thai**. Code, commits, and this file are **English**.

---

## Repository layout

There is **no root `package.json`**. Always run npm inside `frontend/` or `backend/`.

```text
walai_booking/
├── frontend/                 # Next.js App Router (React 19, Tailwind, Axios, Three.js)
│   └── src/
│       ├── app/              # Routes: auth, rooms, kayaks, payment, dashboard, admin, staff
│       ├── components/       # UI, booking calendar, auth/home 3D scenes
│       ├── hooks/            # Auth and shared hooks
│       └── lib/              # api.ts, date helpers, booking-calendar helpers, social
├── backend/                  # Express + TypeScript API
│   └── src/
│       ├── config/           # DB pool, Passport
│       ├── controllers/      # HTTP handlers
│       ├── middleware/       # Auth, validators, uploads
│       ├── routes/           # Mounted under /api
│       ├── services/         # Mail, Cloudinary, cron (auto-cancel, review reminder)
│       └── db/               # migrate / seed scripts
├── docs/                     # Specs, plans, team setup
├── .github/workflows/        # Vercel production deploy via Actions
├── .agents/                  # Optional local agent skills (not required at runtime)
├── AGENTS.md                 # This file
├── README.md
└── CONTRIBUTING.md
```

---

## Stack (current)

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 3, Axios, Lucide, Three.js, Zustand |
| Backend | Express 4, TypeScript, `pg`, Passport JWT + Google OAuth, express-validator, Multer |
| Database | PostgreSQL (local or Neon) |
| Media | Cloudinary (production uploads). Legacy local `backend/uploads/` may still exist for old paths |
| Email | Prefer Brevo HTTPS API (`MAIL_PROVIDER=brevo`). SMTP/Gmail remain fallback paths in `mail.service.ts` |
| Frontend host | Vercel via GitHub Actions (Hobby-friendly collaborator deploy) |
| Backend host | Typically Render (or any Node host) from `main` |

Node.js **20+**. PostgreSQL **14+**.

---

## Commands

```bash
# Backend
cd backend
cp .env.example .env          # fill secrets locally — never commit .env
npm install
npm run dev                   # http://localhost:5000
npm run build                 # tsc → dist/
npm run migrate
npm run seed

# Frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
npm run build
npm run lint
```

Before declaring work done, prefer:

```bash
cd backend && npm run build
cd frontend && npm run build
```

---

## Environment

- Backend secrets live only in `backend/.env` (see `backend/.env.example`).
- Frontend public API base: `frontend/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:5000/api`.
- Never put Cloudinary secrets, Brevo keys, JWT secrets, or DB URLs in the frontend or in docs as real values.
- Do not commit `backend/uploads/**`, `.vercel/`, or generated `frontend/next-env.d.ts` / `tsconfig.tsbuildinfo`.

---

## Agent working rules

1. **Read before write** — Inspect existing controllers, routes, and UI patterns in the same feature area first.
2. **Smallest change** — Do not refactor unrelated files. Match existing style.
3. **No secrets** — Never invent or commit real credentials. Use placeholders.
4. **No root npm** — There is no workspace root package manager.
5. **Ask before big schema / product changes** — Multi-room booking groups, new booking statuses, and payment model changes need an explicit plan and approval.
6. **Commit only when asked** — Do not commit or push unless the user requests it.
7. **Thai UI copy** — Keep customer-facing strings in Thai unless editing English-only admin/docs.
8. **TypeScript** — Prefer explicit return types on new functions; avoid `any`; narrow `unknown`. Prefer `interface` for object shapes. Use `getApiErrorMessage` on the frontend instead of `catch (err: any)`.
9. **API errors** — Backend commonly returns `{ success: false, message: string }`. Prefer that shape for consistency. Do not leak stack traces to clients.
10. **Validate inputs** — New/changed API endpoints should use express-validator (or equivalent) in `backend/src/middleware/validators`.

---

## Domain model (critical)

### Roles

| Role | Storage | Access |
| --- | --- | --- |
| customer | `members` | Book, pay, history, reviews |
| room_staff | `staff.role = 'room_staff'` | Room slip review, approve/reject, check-out |
| boat_staff | `staff.role = 'boat_staff'` | Kayak slip review, approve/reject, return |
| admin | `staff.role = 'admin'` | Full admin + catalog + stats + settings |

Auth: JWT Bearer in `Authorization` header. Frontend stores token in `localStorage` (`frontend/src/lib/api.ts`). Google OAuth optional via Passport.

### Booking status (rooms and kayaks)

PostgreSQL `CHECK` constraints allow only:

```text
pending | paid | approved | rejected | cancelled | checked_out
```

**Never** invent statuses like `completed`, `finished`, `checked_in` without a migration that updates the CHECK constraint **and** all UI/admin branches. Invalid values cause Postgres `23514` and a 500.

Typical room flow:

1. Customer creates booking → `pending`
2. Uploads slip → `paid` (+ `payment_slip` set)
3. Staff approves → `approved` (sets `approved_by_staff_id`) or rejects → `rejected`
4. Staff checks out → `checked_out`

### Room booking mechanics

- One `room_bookings` row = **one physical room** (`room_id`), not a room type alone.
- Create path picks an available room with `FOR UPDATE SKIP LOCKED` (see `createRoomBooking`).
- Price is computed by DB trigger `calculate_booking_price` on insert (nights × rate, promotion applied).
- Trigger `update_room_status_on_booking` sets room `occupied` when approved and `available` on cancel/reject/check-out.
- Calendar availability APIs: `GET /api/rooms/calendar`, `GET /api/kayaks/calendar`, `GET /api/kayaks/rounds-availability`.

### Payment

- Payment UI is keyed as `room_{id}` or `kayak_{id}`.
- Amount comes from the booking row `total_price`.
- Slip upload goes to Cloudinary; booking status becomes `paid`.
- Mail notify staff is fire-and-forget (do not block the HTTP response on mail).

### Mail

- Central module: `backend/src/services/mail.service.ts`.
- Production preference: Brevo API. Keep controller calls non-blocking:

```ts
(async () => { try { await sendSomething(...); } catch (e) { console.error(e); } })();
```

---

## API map (high level)

Mounted under `/api` from `backend/src/index.ts`:

| Prefix | Purpose |
| --- | --- |
| `/api/auth` | Login, register, Google OAuth, password reset |
| `/api/rooms` | Room types, rooms, calendar |
| `/api/bookings` | Room booking CRUD / status / my bookings |
| `/api/kayaks` | Kayak catalog, calendar, rounds availability, boat bookings |
| `/api/payments` | QR / bank info + slip upload |
| `/api/uploads` | Media helpers |
| `/api/reviews` | Reviews |
| `/api/settings` | Resort info, stats, site settings |
| `/api/promotions` | Promo codes |
| `/api/members` | Member admin |

When adding endpoints: route → controller → validator → keep response `{ success, message?, data? }`.

---

## Frontend conventions

### Design system

Tokens live in `frontend/tailwind.config.ts` and utility classes in `frontend/src/app/globals.css`:

- Backgrounds: `cream-*`
- Primary: `forest-*` (brand green `#123C30` ≈ `forest-800`)
- Secondary: `lagoon-*`
- Accent: `bamboo-*`
- Text: `charcoal` / `charcoal-*`

Fonts: **Pridi** (display), **Sarabun** (body). See `.impeccable.md`.

Avoid “AI slop” defaults: purple gradients, generic gray SaaS cards, cyan-on-dark, emoji decoration, Inter/Roboto as brand fonts. Prefer editorial, nature-first layouts already used on home/auth/booking pages.

Shared button/input classes: `.btn-primary`, `.btn-secondary`, `.input-field`, `.card`, etc. in `globals.css`.

### Key UI modules

- Calendar booking: `frontend/src/components/booking/BookingCalendar.tsx`
- Date helpers: `frontend/src/lib/date.ts` (Thai labels, Buddhist year display where used)
- Calendar API mapping: `frontend/src/lib/booking-calendar.ts`
- API client + errors: `frontend/src/lib/api.ts` (`getApiErrorMessage`)
- Auth pages use full-height split layouts + optional Three.js scenes under `components/auth/` and `components/3D/`
- Load 3D with `next/dynamic` and `{ ssr: false }`

### Staff / admin dashboard action order

When rendering booking action buttons, check **status first**, then slip. Never check `payment_slip` before terminal statuses (`checked_out`, `rejected`, `cancelled`), or staff will see approve/reject again on finished bookings.

---

## Rate limits

In `backend/src/index.ts`:

- General `/api/`: 5000 / 15 min
- Auth login / forgot-password: 20 / 15 min (`skipSuccessfulRequests` on auth limiter)

Do not lower the general limiter aggressively in development; dashboards and multi-tab use will hit 429.

---

## Deploy

- Production git branch: `main`
- Frontend: `.github/workflows/deploy-frontend.yml` on pushes that touch `frontend/**` (needs GitHub secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
- Disable Vercel automatic Production Git deploys to avoid double deploys when Actions is the source of truth
- Backend: deploy from the same repo/`main` on the API host

Details: `CONTRIBUTING.md`, `docs/TEAM_SETUP.md`.

---

## Security checklist for agents

- Never commit `.env`, payment slips, or real bank/PromptPay IDs into README or examples.
- Rotate any secret that was ever pasted into chat or an old commit.
- Uploads: use Cloudinary helpers in `backend/src/services/cloudinary.service.ts`; do not reintroduce long-term local slip storage as the primary path.
- Auth middleware and role checks must gate staff/admin routes.

---

## Known product direction (do not implement casually)

**Multi-room booking in one checkout** was designed in discussion but not shipped:

- Multiple room types allowed
- One payment
- Shared check-in / check-out dates
- Recommended model: new `booking_groups` header + many `room_bookings` rows linked by `booking_group_id`

Do not start this without an approved plan/spec. Related brainstorming may continue in chat; write a design doc under `docs/superpowers/specs/` before coding.

Adding a `checked_in` status also requires a DB CHECK migration and UI updates — not a one-line status string change.

---

## Where to look first

| Task | Start here |
| --- | --- |
| Room booking create / status | `backend/src/controllers/booking.controller.ts` |
| Kayak booking / calendar | `backend/src/controllers/kayak.controller.ts` |
| Room calendar / inventory | `backend/src/controllers/room.controller.ts` |
| Payment + slip | `backend/src/controllers/payment.controller.ts` |
| Auth / password reset | `backend/src/controllers/auth.controller.ts` |
| Mail | `backend/src/services/mail.service.ts` |
| Customer room UI | `frontend/src/app/rooms/` |
| Customer kayak UI | `frontend/src/app/kayaks/` |
| Payment UI | `frontend/src/app/payment/` |
| Admin room dashboard | `frontend/src/app/admin/rooms/dashboard/` |
| Design tokens | `frontend/tailwind.config.ts`, `frontend/src/app/globals.css` |

---

## Docs for deeper work

| Doc | Use |
| --- | --- |
| `README.md` | Setup, env, tables, deploy overview |
| `CONTRIBUTING.md` | Branch / PR / collaborator deploy |
| `docs/TEAM_SETUP.md` | Owner: GitHub secrets + Vercel Actions |
| `docs/superpowers/specs/` | Feature design specs |
| `docs/superpowers/plans/` | Step-by-step implementation plans |
| `.impeccable.md` | Brand and UI taste |
| `.agents/skills/` | Optional design/process skills for Cursor-local agents |

---

## Definition of done (agent)

A change is done only when:

1. Behavior matches the request and existing domain rules above.
2. Relevant `npm run build` (backend and/or frontend) succeeds for touched packages.
3. No secrets or uploads were added to git.
4. UI still uses project tokens / patterns when the change is visual.
5. Status / payment / role edge cases were considered if bookings were touched.
