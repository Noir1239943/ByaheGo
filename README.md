# ByaheGo – Car Rental Platform for Cebu

> *Your journey, our priority.* Rent cars, SUVs, vans, pickups and motorcycles from verified local hosts across Cebu.

```
ByaheGo/
├── frontend/   React + TypeScript + Vite + Tailwind CSS  (deploy to Vercel)
├── backend/    Laravel 13 REST API + PostgreSQL           (deploy to Render, database on Neon)
└── render.yaml Optional Render blueprint for the API
```

---

## Demo accounts

| Role | Username | Password | What to try |
|---|---|---|---|
| **Admin** | `Admin` | `Password123` | Overview, ID verifications, listings, disputes, refunds, payouts, users |
| **Renter** | `Test123` | `Password123` | Book, pay, cancel, receipts, reviews, saved vehicles, apply to host |
| Host (extra) | `Host123` | `Password123` | Host dashboard, handover & return checks, late fees, add a vehicle |

You can also log in with the email (e.g. `test123@byahego.test`). Other seeded renters/hosts use the same password.

**Test payments** run in test mode (no real money): GCash/Maya with any 11-digit mobile number (e.g. `0917 123 4567`), card `4242 4242 4242 4242` (any future expiry, any CVC). Card `4000 0000 0000 0002` simulates a declined payment.

---

## What the professor asked for → what we built

| Question / gap | How ByaheGo handles it |
|---|---|
| Sign in with Google (Apple & magic links excluded) | **Continue with Google / Facebook** on login/register (Laravel Socialite redirect flow with a one-time code, no token in any URL). Accounts are linked by email only when the provider confirms it. Needs OAuth keys – see *Social sign-in setup*; a button is hidden when its keys are missing. |
| Driver's license + selfie – how is it validated? Who verifies? | 4-step **identity verification** (license type → front/back/selfie upload → details → restriction codes). An **automatic document checker** runs 10 checks: LTO number format, expiry, age 21+, name match with the account, photo resolution, selfie ≠ license photo, photos reused by another account, license number already on another account, car restriction codes. The **admin** reviews the photos + check results and approves or rejects (with reason). Admin can also **revoke** a verification or **suspend** an account. (Real-time biometric face match was excluded.) |
| Nearest pick-up | **"Nearest to me"** sort uses the browser's location; distance is calculated on the server and shown on every card. "Show cars nearest to me" shortcut on the home search. |
| Excess hours / penalty | **Late-return fee**: 60-minute grace period, then the vehicle's hourly late fee, capped at 1.5× the daily rate per day late. Calculated automatically when the host records the return, deducted from the deposit, any extra billed as a balance the renter pays online. Overdue trips are flagged. |
| Mobile-first – app or web app? | **Installable PWA** (manifest, service worker, offline-cached app shell and vehicle photos, "Install the ByaheGo app" banner/menu item). Fully responsive layouts. |
| Payment gateway, Apple Pay, Google Pay, online cash | Checkout supports **GCash, Maya** (e-wallet "online cash"), **cards, Google Pay and Apple Pay** through a payment-gateway service class (test mode). Swap in a live provider like PayMongo by replacing `app/Services/PaymentGateway.php`. |
| Live availability map – how is it real-time? | **Live map** (OpenStreetMap/Leaflet) with color-coded pins: available / on a trip now / booked for your dates. It **refreshes every 15 seconds** from the server, with a "Live · updated Xs ago" indicator. |
| Filters on the server? | **Yes.** Type, price, seats, transmission, fuel, rental type (with driver), instant book, delivery, pet-friendly, location, text search and **date availability** are all filtered in the database. Filters live in the URL so results can be shared. |
| Pagination – server or client? | **Server-side pagination** (Laravel `paginate`, 9 per page). The API returns one page + meta; the client renders numbered pages. |
| OR / Invoice | Every payment and refund gets an **official receipt number** (OR-/RF-). Each trip has a printable **invoice** (VAT breakdown, receipts list) – "Print / Save as PDF". |
| Contract – liable for damage? | **Rental agreement** must be accepted at checkout (version, date and IP are recorded). Liability is capped by the chosen **protection plan** (Standard ₱20,000 / Plus ₱8,000 / Premium ₱2,500). Hosts file **damage claims** at return; the deposit stays **on hold** until an admin approves, reduces or dismisses the claim. |
| How does a host register? | **Become a host application** (vehicles, city, payout account) → admin approval → host dashboard. Every new **vehicle listing** (photos + OR/CR) is reviewed by an admin before it goes live. |
| Billing history | **Payments & billing** page: totals, deposits on hold, and every charge/refund/fee with receipt numbers. |
| Car stolen? Parts stolen from the engine? | Theft, missing parts and tampering are **not covered** by protection plans (full liability, account suspended, reported to PNP). **Pick-up and return inspections** record odometer, fuel and a checklist that includes the **engine bay/battery** and tools. Hosts can report **theft/missing parts** incidents; admins resolve them and can suspend the renter. |
| Refund feature | Automatic **full refund** on eligible cancellations, **deposit refunds** after each trip, and **manual (partial) refunds** by admins – all with receipts. |
| Cancel booking – a day before | Renters can cancel **up to 24 hours before pick-up** for a full refund (rental + deposit). After that, the button is replaced by a clear message; admins can still cancel. |

### Extra pages & functions (not in the Figma)
Live availability map · Become-a-host landing + application · Help center with FAQ and contact form (→ admin support inbox) · Rental agreement/Terms · Privacy policy · About · How it works · 404 page · Notifications center (bell + page) · Billing history · Printable invoice/OR · Add trip to calendar (.ics) · Leave a review · Report a problem during a trip · Pay a remaining balance · Price-drop alerts on saved vehicles · Host payout account · Host earnings chart & payouts · Admin: payments & refunds, payouts, ID verifications, host applications, listings review, disputes, users (suspend/reinstate/revoke), support inbox, platform settings (fees, commission, grace period, cancellation cut-off).

---

## Grading checklist

**Project setup** – React 19 + Vite · Tailwind CSS v4 (`@tailwindcss/vite`, design tokens in `src/index.css`) · React Router (`createBrowserRouter`, lazy-loaded routes) · Alias path `@/` → `src/` (`vite.config.ts` + `tsconfig.app.json`) · `cn()` = `clsx` + `tailwind-merge` (`src/lib/cn.ts`).

**Project structure** – `pages/` (by area: public, auth, checkout, verification, account, host, admin) · `layouts/` (Root, Main, Account, Auth, Checkout, Focus, Dashboard → Host/Admin, Print) · `routes/` (router + guards) · `services/` (API calls) · `hooks/` · `context/` · `lib/` · `types/`.

**Component architecture**
- `components/ui/` – reusable building blocks with props: Button, Input/Select/Textarea, Checkbox, Switch, Badge, Card, Modal, Drawer, Tabs/Segmented, Table, Pagination, Stepper, Chip, Dropdown, Avatar, EmptyState, Alert…
- `components/common/` – app-wide pieces: SiteHeader, SiteFooter, Logo, SearchBar, VehicleCard, VehicleArt, MapView, PriceBreakdown, StatusBadge, ImageUploader, DashboardSidebar…
- `components/features/<domain>/` – sections and feature components: home, vehicles, auth, checkout, verification, account, bookings, host, admin, static.

**Page composition** – every file in `src/pages/` only renders section components, e.g.

```tsx
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <VehicleTypesSection />
      <TopRatedSection />
      <PeaceOfMindSection />
      <HowItWorksSection />
      <HostCtaSection />
    </>
  )
}
```

**UI/UX** – Follows the ByaheGo Figma design system (Plus Jakarta Sans, lagoon teal `#0D7C6B`, mango `#FFB224`, deep green hero `#0B2F2D`). Responsive from 360 px phones to desktop (mobile drawers for menus and filters, sticky "Check availability" bar). Loading skeletons, friendly empty states and plain-language errors everywhere. Vehicle illustrations from the design system are used until hosts upload real photos.

---

## Run it locally

**Requirements:** PHP 8.3+ with `pdo_sqlite` (or `pdo_pgsql`) and the `gd` + `fileinfo` extensions (uncomment `extension=gd` and `extension=fileinfo` in `php.ini`), Composer 2, Node 20+.

```bash
# 1) API
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite          # Windows: type nul > database\database.sqlite
php artisan migrate --seed
php artisan serve                       # http://localhost:8000

# 2) Website (new terminal)
cd frontend
npm install
cp .env.example .env                    # VITE_API_URL=http://localhost:8000
npm run dev                             # http://localhost:5173
```

Tests: `cd backend && php artisan test` (28 feature tests: auth, Google sign-in, server-side filters & pagination, availability, booking & payment, declined cards, 24-hour cancellation rule, refunds, late fees, damage/theft disputes, verification checks, host application & listing approval, suspensions, settings).

---

## Deploy (same as last time: Neon → Render → Vercel)

You can push this folder as **one GitHub repo** (Render uses `backend/`, Vercel uses `frontend/`) or as two repos (push each folder separately – then skip the "Root Directory" settings).

### 1. Database – Neon
1. Create a project at neon.tech (region: Singapore).
2. Copy the connection string (Dashboard → Connect), e.g.
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### 2. API – Render
1. New → **Web Service** → connect the repo → **Runtime: Docker**, **Root Directory: `backend`**, Instance type: Free.
2. Environment variables:

| Key | Value |
|---|---|
| `APP_KEY` | run `php artisan key:generate --show` locally and paste it |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | your Render URL, e.g. `https://byahego-api.onrender.com` |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` | the Neon connection string |
| `CORS_ALLOWED_ORIGINS` | your Vercel URL (or `*` while testing) |
| `LOG_CHANNEL` | `stderr` |
| `SESSION_DRIVER` / `CACHE_STORE` | `array` / `file` |
| `FRONTEND_URL` | your Vercel URL (OAuth return + password-reset links) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional (see below) |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | optional (see below) |

3. Deploy. On start the container runs `migrate --force` and `db:seed --force`. **The seeder only fills an empty database**, so the demo data is created once in Neon on the first deploy and is never reset afterwards – from then on your data lives in Neon. (To skip demo data, delete the `db:seed` line in `backend/docker/start.sh`.)
4. Check `https://<your-api>.onrender.com/api/health` → `{"ok":true}`.

*Tip:* the free Render plan sleeps after 15 minutes; the first request after that takes ~50 seconds. Open the API URL a minute before presenting.

Alternatively use **New → Blueprint** with the included `render.yaml`.

### 3. Website – Vercel
1. New Project → import the repo → **Root Directory: `frontend`** (Framework: Vite).
2. Environment variable: `VITE_API_URL` = your Render URL (no trailing slash).
3. Deploy. `vercel.json` already handles page refreshes on routes like `/vehicles/3`.
4. Put the Vercel URL into Render's `CORS_ALLOWED_ORIGINS` and redeploy the API.

### Social sign-in setup (optional)
**Google:** console.cloud.google.com → APIs & Services → Credentials → Create credentials → OAuth client ID → *Web application*. Under **Authorized redirect URIs** add `<APP_URL>/api/auth/google/callback` (and `http://localhost:8000/api/auth/google/callback` for local). Put the Client ID and Client secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**Facebook:** developers.facebook.com → Create app (Consumer) → add **Facebook Login** → Settings: **Valid OAuth Redirect URIs** = `<APP_URL>/api/auth/facebook/callback`. Basic settings: set your **Privacy Policy URL** (`<FRONTEND_URL>/privacy`) and **Terms** URL (`<FRONTEND_URL>/terms`). Put the App ID and App Secret in `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`. Switch the app to *Live* when ready.

Set `FRONTEND_URL` to the website so the API can send people back. Password reset emails go through the configured mailer (`MAIL_MAILER=log` writes them to `storage/logs` locally).

---

## How things work (quick reference)

**Pricing** – rental (daily rate × days, weekly rate for 7+ days) + driver fee + protection plan + 7.5% service fee = trip total. A refundable deposit is collected with the payment and settled after the return check.

**Trip lifecycle** – Booked & paid → host starts handover (pick-up check) → host records return (late fee auto-calculated, optional damage report) → deposit settled (refund minus fees; balance billed if fees exceed the deposit) → host payout scheduled 3 days later → admin marks payout as sent.

**Main API endpoints** (`/api`)
- Public: `POST auth/login|register|google`, `GET vehicles` (filters + pagination), `GET vehicles/map`, `GET vehicles/{id}`, `POST vehicles/{id}/quote`, `GET hubs`, `POST support`
- Renter: `GET/PUT me`, `GET me/billing`, favorites, recently viewed, notifications, `POST media`, `GET/POST verification`, `GET/POST bookings`, `POST bookings/{ref}/cancel|pay-balance|review|incidents`, `GET/POST host-application`
- Host: `host/dashboard`, `host/earnings`, `host/vehicles` (CRUD + submit/pause/resume), `host/bookings/{ref}/pickup|return|incidents`
- Admin: `admin/overview`, `admin/bookings` (+ cancel, refund, note, message), `admin/payments`, `admin/payouts`, `admin/verifications`, `admin/host-applications`, `admin/listings`, `admin/disputes`, `admin/users` (+ suspend, reinstate, revoke-verification), `admin/support`, `admin/settings`

**ID verification checks** – The renter's browser runs the face and text checks (face detection, liveness/anti-spoof, face match and OCR with `@vladmandic/human` and `tesseract.js`, loaded only on the verify page; model files live in `frontend/public/models` and `frontend/public/tesseract`, and photos never leave the app for these checks). The selfie is a live camera capture only. These results are stored as `client_checks` and shown to admins tagged "device-reported", because a browser can be tampered with. The API runs its own checks (real image file, minimum size, perceptual-hash near-duplicates within a submission and across accounts, address sanity, license format/expiry/age/name, license already on another account). Every check is `pass`, `warn`, `fail` or `not_checked`; critical failures cap the score at 30% ("Likely fake – reject") and a missing image check can't score above 60%. Thresholds: `frontend/src/lib/verification/config.ts` and `backend/app/Services/VerificationChecker.php`.

**Account blocking and the audit log** – Admins can *suspend* an account (temporary, with an end date; it reactivates by itself, hourly command `accounts:lift-expired`), *revoke* it (permanent) or reinstate it, always with a reason. The person is signed out everywhere at once, and at login sees the reason, the end date and how to appeal (`SUPPORT_EMAIL`). Blocked hosts' listings disappear from search; upcoming trips of a blocked renter or host are flagged under *Bookings → Needs decision* for an admin (cancelling gives the renter a full refund). Every admin action is written to the admin **Audit log** page (who, what, when, reason).

**Hosting requirements** – Only ID-verified users can apply to host. The application stores the payout account number encrypted (`APP_KEY` must never change or it can't be read back). A listing can only be submitted with at least 3 photos, the OR and CR, a valid CTPL insurance photo and expiry date, a plate number and its pricing, grace period, late-fee and fuel-policy settings; an admin approves or sends it back with a reason.

**Automatic decisions** – Critical failures (no face on the license or selfie, liveness/anti-spoof failed, face mismatch, expired license, license on another account, near-duplicate photos) are **always auto-rejected**: the renter gets a message saying what to retake and can resubmit. A submission is **auto-approved** only if `VERIFICATION_AUTO_APPROVE=true` *and* every check passes with no warnings *and* face match, liveness and anti-spoof clear their minimums by the margins in `backend/config/verification.php`. Everything else lands in the admin queue as "Needs review". Auto-decided submissions have their own tabs in the admin ID verifications page; a super admin (`users.is_super_admin`, the seeded `Admin` account) can override them. Every automatic decision and override is stored in `verification_decisions` (checks, scores, thresholds, timestamp, actor).

Uploaded photos (licenses, OR/CR, vehicle photos) are stored in the database so they survive Render redeploys; license and OR/CR photos are private (only the owner and admins can open them).
