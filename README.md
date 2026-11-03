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

**Test payments** run on Xendit's test mode (no real money). At checkout you are sent to Xendit's page: for GCash or Maya press **Proceed to Pay** on the test wallet page; for a card use `4000 0000 0000 1000` (expiry `12/30`, any CVC, any name). See *Payments (Xendit)* below.

---

## What the professor asked for → what we built

| Question / gap | How ByaheGo handles it |
|---|---|
| Sign in with Google (Apple & magic links excluded) | **Continue with Google / Facebook** on login/register (Laravel Socialite redirect flow with a one-time code, no token in any URL). Accounts are linked by email only when the provider confirms it. Needs OAuth keys – see *Social sign-in setup*; a button is hidden when its keys are missing. |
| Driver's license + selfie – how is it validated? Who verifies? | 4-step **identity verification** (license type → front/back/selfie upload → details → restriction codes). An **automatic document checker** runs 10 checks: LTO number format, expiry, age 21+, name match with the account, photo resolution, selfie ≠ license photo, photos reused by another account, license number already on another account, car restriction codes. The **admin** reviews the photos + check results and approves or rejects (with reason). Admin can also **revoke** a verification or **suspend** an account. (Real-time biometric face match was excluded.) |
| Nearest pick-up | **"Nearest to me"** sort uses the browser's location; distance is calculated on the server and shown on every card. "Show cars nearest to me" shortcut on the home search. |
| Excess hours / penalty | **Late-return fee**: 60-minute grace period, then the vehicle's hourly late fee, capped at 1.5× the daily rate per day late. Calculated automatically when the host records the return, deducted from the deposit, any extra billed as a balance the renter pays online. Overdue trips are flagged. |
| Mobile-first – app or web app? | **Installable PWA** (manifest, service worker, offline-cached app shell and vehicle photos, "Install the ByaheGo app" banner/menu item). Fully responsive layouts. |
| Payment gateway, online cash | Checkout runs on **Xendit** hosted checkout: **GCash, Maya, cards, QR Ph, GrabPay, ShopeePay**. See *Payments (Xendit)* below. Apple Pay and Google Pay are not offered (not available on Xendit's Philippine channels). |
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

**Requirements:** PHP 8.3+ with `pdo_pgsql`, `gd` and `fileinfo` (in `php.ini` uncomment `extension=pdo_pgsql`, `extension=pgsql`, `extension=gd`, `extension=fileinfo`; add `extension=pdo_sqlite` too if you want to run the tests), Composer 2, Node 20+, and a free [Neon](https://neon.tech) project (the app uses Postgres everywhere, there is no local database file).

```bash
# 1) API
cd backend
composer install
cp .env.example .env                    # then paste your Neon DIRECT connection string into DB_URL
php artisan key:generate
php artisan migrate:fresh --seed        # creates the schema and all demo data in Neon (takes a few minutes over the network)
php artisan serve                       # http://localhost:8000

# 2) Website (new terminal)
cd frontend
npm install
cp .env.example .env                    # VITE_API_URL=http://localhost:8000
npm run dev                             # http://localhost:5173
```

Tests: `cd backend && php artisan test` (108 feature tests, run on an in-memory SQLite database so they never touch Neon, with Xendit faked: auth, social sign-in, password reset, account blocking, ID verification, host applications, server-side search, distance, privacy of pick-up pins, blocked dates, availability, the rental agreement, Xendit checkout, webhooks, refunds and invoices, 24-hour cancellation rule, late fees, damage/theft disputes, suspensions, settings).

---

## Finding cars: search, location and the live map

**Search is done in the database.** `GET /api/vehicles` validates every query parameter (a bad value is a clear 422, never silently ignored) and filters in SQL: place text, dates, price range, type, transmission, seats, fuel, keyword and distance. Sorting: recommended, price low/high, rating, newest, nearest. Pages are 12 cars, with `meta` (total, current page, last page). The page, filters and sort live in the URL, so a link can be shared and survives a refresh. Indexes cover the filtered columns (`status` + price/type/transmission/fuel/seats/city, and `lat, lng`), plus the booking date window.

**Dates.** A car is shown for a date range only when it has no confirmed or active booking that overlaps, and the host has not blocked any of those days (hosts do that under *My vehicles → Block dates*).

**Nearest pick-up.** Hosts place a pin on a Leaflet map (click, drag, search an address, or use their location). The address search uses OpenStreetMap Nominatim the way its usage policy asks: debounced, at most one request per second from a shared queue, results cached, Philippines only, and the browser's Referer identifies the site (optionally set `VITE_NOMINATIM_EMAIL`). Renters tap *Use my location* or pick an area, then choose a radius (2–50 km); cards show "2.4 km away".

*Distance choice.* The SQL does a bounding-box pre-filter on the indexed `lat, lng` columns, then an exact radius check with a flat-earth (equirectangular) formula that runs unchanged on Postgres and on SQLite, so the tests exercise the same query as production. Within a city it is within 0.1% of Haversine. The kilometres shown on a card are computed with Haversine in PHP.

**Privacy of the pin.** For a host's own location the search, the cards, the map and the car page only ever get the barangay/area and a point rounded to 0.01 degree (about 1 km), and sorting and radius use that rounded point too, so repeated searches cannot be used to find the house. The exact pin, address and meeting spot are copied into the booking when it is confirmed and are shown to that renter and the host. If the renter cancels, they go back to seeing only the area. ByaheGo hubs are public places, so their exact location is always shown.

**List / Map toggle.** The same page switches between the grid and a map (`/vehicles?view=map`) with the same filters and dates. Markers show the price and are coloured: green available, amber on a trip right now, red unavailable for the dates. *Available* means: live listing, host not suspended, no overlapping booking and no blocked day. The map refetches every 30 seconds while the tab is visible, stops while it is hidden, and refreshes when you come back ("Updated just now").

*Making it fully real-time later.* We deliberately use polling, not websockets. With Laravel Reverb the API would broadcast a `VehicleAvailabilityChanged` event (from `BookingService`, the host's block/unblock and pause actions, and the account blocking service) on a public `availability` channel; the map would subscribe with Laravel Echo and update just that marker instead of polling. Reverb is a separate long-running process, so it needs a host that runs one (a paid Render service or a small VPS), and a free Render web service cannot keep websocket workers alive.

---

## Rental agreement, deposit and cancellation

**Agreement (e-signature).** `POST /api/vehicles/{id}/agreement` fills a versioned template (`AgreementService::VERSION`, now `2026.2`) with the trip: renter's verified name, host, car and plate, dates and times (Philippine time), pick-up area, the full price breakdown, deposit, fuel policy, the listing's grace period and excess-hour rate, the cancellation rule with the exact "Free cancellation until" date, damage liability, loss/theft, fines, no sub-renting or illegal use, and accident reporting. At checkout the renter has to scroll the text to the end, tick *I agree* and type their full name, which must match the name on their verified license (same words, any order, ignoring case and accents). The server regenerates the text when the booking is made and refuses it if the hash differs from what the renter was shown, so the signed text is always the text they saw.

**Signed snapshot.** `booking_agreements` keeps the rendered text, version, SHA-256 hash, typed name, time, IP address and browser of the signer. It never changes afterwards, even if prices or the template change later. Bumping `VERSION` only affects new bookings.

**PDF and email.** The renter, the host and admins can download the signed PDF (`GET /api/bookings/{ref}/agreement.pdf`, `/api/host/...`, `/api/admin/...`). When a booking is confirmed, the renter and the host each get an email with the PDF attached. Locally `MAIL_MAILER=log` writes the emails to `storage/logs`; for real emails set `MAIL_MAILER=smtp` and the `MAIL_*` keys on Render. A failing mail server is logged and never undoes a paid booking.

**Deposit.** Hosts set it per listing; if they leave it empty a new listing gets the platform default (admin Settings, ₱3,000 to start). It is charged as its own line with the payment and shown on the listing, at checkout and in the agreement. Status: held, then released (nothing deducted), partially released (some deducted) or applied (all deducted). It is released when the host records the return without a problem; if there is a damage report it stays on hold until an admin decides the deduction. A trip that is completed but whose deposit was somehow never settled is settled by `deposits:release-due` after the release window (default 3 days).

**Cancellation.** A renter can cancel until 24 hours before pick-up (admin setting) and gets the rental and the deposit back. The platform can set a cancellation fee in whole pesos (default ₱0), kept from that refund. Inside the window the Cancel button is replaced by a clear message, with a link to support (and *Report a problem* once the trip starts). A host can cancel at any time: the renter always gets everything back, no fee, the cancellation is counted on the host (`users.host_cancellations`, shown to admins on the user page) and admins are notified. Admins can cancel at any time with or without a refund. "Free cancellation until ..." is on the listing, checkout, agreement and trip page.

**Unpaid bookings.** A booking in `pending` status holds the car's dates until `expires_at` (admin setting, 30 minutes by default). `bookings:expire-pending` cancels expired ones every minute, and a lapsed hold stops blocking dates immediately, even before that job runs. Nothing creates pending bookings yet: the card/e-wallet checkout of Phase 4 will.

**Scheduled jobs.** `docker/start.sh` runs `php artisan schedule:work` beside Apache: expire pending bookings (every minute), lift ended suspensions and settle old deposits (hourly). On Render's free plan the service sleeps after 15 minutes without traffic and the jobs pause. Because lapsed holds, ended suspensions and the cancellation window are all checked at request time too, nothing depends on the jobs running on time. On a paid or always-on host they simply run on schedule.

---

## Payments (Xendit)

Checkout uses **Xendit's hosted payment page** (Payment Sessions). Card and wallet details are typed on Xendit's page and never reach our server.

**Methods:** GCash, Maya, cards, QR Ph, GrabPay, ShopeePay (Xendit channel codes `GCASH`, `PAYMAYA`, `CARDS`, `QRPH`, `GRABPAY`, `SHOPEEPAY`). **Apple Pay and Google Pay are not offered**: Xendit's Philippine channels don't include them, and we don't fake them. If Xendit adds them, they are a one-line addition to `PaymentGateway::METHODS` / `CHANNELS`.

**How a booking becomes paid**
1. The renter signs the agreement and presses *Continue to payment*. The booking is saved as **pending** (dates held for `pending_booking_minutes`, default 30) and a Xendit session is opened for it.
2. The renter pays on Xendit's page and is sent back to `/checkout/return/<booking>`.
3. The booking becomes **confirmed only after Xendit says the session is completed**. Three things can trigger that check, and all of them end in the same idempotent `PaymentService::confirm()`: the **webhook**, the **return page** (asks the API, which asks Xendit, so it works on localhost where webhooks can't reach), and the **`payments:sync` task** (every 5 minutes). Nothing the browser or a webhook body claims is trusted: the server always re-reads the real state from Xendit's API.
4. On confirmation: the invoice (`BYG-2026-000123`) is issued, the host is told, and renter and host get the confirmation email (agreement + invoice PDFs).

**Refunds** go through Xendit's Refunds API (partial refunds supported): renter cancellation, host cancellation, deposit return, admin refund. Xendit answers *pending* first; the webhook (or `payments:sync`) finishes it and issues the refund receipt (`BYG-RF-2026-000045`). A refund Xendit refuses is saved as **failed** and never blocks a cancellation: the admin sees it on *Payments & refunds* and can **Retry** or mark it **Paid by hand**. Real rules seen in test mode: *Maya doesn't allow a partial refund on the day of payment* (a full refund is fine), and *card refunds only accept the reasons FRAUDULENT, DUPLICATE or REQUESTED_BY_CUSTOMER* (the app maps this for you).

**Invoices and receipts** are PDFs made with dompdf, one per payment and one per refund, numbered in order and frozen when issued. They say *"System-generated invoice. Not a BIR-registered official receipt."* Renters download them from **Payments & billing** and the trip page, admins from *Payments & refunds*.

### Set it up locally
1. In your Xendit dashboard (test mode) create a **secret API key** that is allowed to create payments and refunds (menu names vary a little, look for *Settings → API keys*). Put it in `backend/.env` as `XENDIT_SECRET_KEY`.
2. The **webhook verification token** (in the dashboard's webhook settings) goes in `XENDIT_CALLBACK_TOKEN`.
3. Xendit only sends people back to **https** addresses, so the website needs a local certificate:
   ```bash
   cd frontend
   mkdir .cert
   openssl req -x509 -newkey rsa:2048 -nodes -keyout .cert/localhost-key.pem -out .cert/localhost.pem -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
   ```
   `npm run dev` then serves **https://localhost:5173** (your browser warns once about the self-made certificate: *Advanced → Continue*). Set `FRONTEND_URL=https://localhost:5173` in `backend/.env`.
4. Windows: if payments fail with *"SSL certificate problem"*, PHP has no CA list. Either set `XENDIT_CA_BUNDLE` (see `.env.example`) or put a `cacert.pem` path in `php.ini` (`curl.cainfo` and `openssl.cafile`).
5. Webhooks can't reach `localhost`; you don't need them for local testing (the return page and `payments:sync` do the job). To try real webhooks, expose the API with a tunnel (for example ngrok) and register that URL as below.

### Test each method (Xendit test mode)
| Method | What to do on Xendit's page |
|---|---|
| GCash / Maya | choose the wallet, press **Pay**, then **Proceed to Pay** on the test wallet page |
| Card | card `4000 0000 0000 1000`, expiry `12/30`, CVC `123`, any name, email and phone |
| Refund | cancel a paid trip in *My trips* (shows *Refund processing*, then *Refunded* once Xendit finishes) |

### Go live on Render
1. Render → your service → Environment: add `XENDIT_SECRET_KEY` and `XENDIT_CALLBACK_TOKEN` (and make sure `FRONTEND_URL` is your Vercel URL, which is https).
2. In the Xendit dashboard's webhook settings, set the URL for the payment-session and refund notifications to `https://<your-api>.onrender.com/api/webhooks/xendit`. The endpoint answers `401` if the token is wrong and `200` otherwise; it reacts to any event whose name starts with `payment_session` or `refund`, and ignores the rest.
3. The container starts `php artisan schedule:work` (see `docker/start.sh`), which runs `payments:sync` every 5 minutes, `bookings:expire-pending` every minute and `deposits:release-due` hourly. The free Render plan sleeps, so these pause while it sleeps; every payment and refund is also re-checked whenever someone opens it.
4. To accept real money, switch the key to the live secret key (`xnd_production_...`) once Xendit has activated your account and the channels (GCash, Maya, cards...) you want.

---

## Database size (photos live in Postgres)

Photos are compressed in the browser (max 1600 px, JPEG 82%), so one photo is about 250–400 KB, or 350–530 KB once base64-encoded in the database.

| What | Photos | Approx. size |
|---|---|---|
| One renter's ID check (front, back, live selfie) | 3 | ~1.2 MB |
| One listing (4 photos + OR + CR + CTPL) | 7–8 | ~3 MB |
| One trip's pickup and return inspection (about 8 + 8 photos) | ~16 | ~6 MB |

Neon's free plan stores 0.5 GB (about 500 MB). That is roughly 150 listings, or 400 ID checks, or 80 fully photographed trips, and a mix of them fills it sooner. Plan to move to a paid Neon plan, or to object storage for photos (S3, Cloudflare R2 or Supabase Storage, keeping only the URL in the database), before real traffic. The demo seed data alone uses a few tens of MB.

---

## Deploy (same as last time: Neon → Render → Vercel)

You can push this folder as **one GitHub repo** (Render uses `backend/`, Vercel uses `frontend/`) or as two repos (push each folder separately – then skip the "Root Directory" settings).

### 1. Database – Neon
1. Create a project at neon.tech (region: Singapore).
2. Copy the connection string (Dashboard → Connect), e.g.
   `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   **Turn "Connection pooling" off before copying**, so the host has no `-pooler` in it. Laravel's migrations fail through Neon's pooler (the first statement aborts the transaction). The direct connection is fine for this app's size.
3. Photos are stored in the database as base64, so watch the storage meter (free plan: 0.5 GB). See "Database size" below.

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
