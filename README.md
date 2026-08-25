# CUP LAB POS

CUP LAB is a cashier-focused point-of-sale application built with React, Vite, TypeScript, Tailwind CSS, and Supabase. It includes product management, database-driven ICE pricing, in-memory cart preparation, atomic checkout, order history, and daily sales reports grouped by category, product, and payment method.

## Technology

- React 19 and React Router
- Vite and TypeScript
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, and Row Level Security
- Zod, Lucide React, and Vitest
- Python FastAPI and UniFace for face verification

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project
- Supabase CLI, recommended for applying migrations

## Local installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set only these browser-safe values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_FACE_API_URL=http://localhost:8000
```

Never expose a service-role key, database password, or other server secret through a `VITE_` variable.

## Supabase setup

Apply every SQL file in `supabase/migrations` in filename order. With the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations are intentionally kept separate because they form ordered database history. Do not rerun the initial migration against a database where it has already been applied.

The migrations create and secure products, categories, ICE tiers, completed orders, historical item snapshots, payment data, and the `product-images` Storage bucket. RLS remains enabled. Checkout prices and cash change are validated in PostgreSQL rather than trusted from the browser.

## First owner/cashier account

Supabase Auth still requires an email internally. This application converts a username to an internal email in this form:

```text
username@coffee-shop.local
```

Create the account in Supabase Dashboard under Authentication > Users. For username `admin`, use `admin@coffee-shop.local`, choose a strong password of at least eight characters, and set the display name in the user metadata or matching `profiles.full_name` row. The login screen accepts only the username portion, such as `admin`.

Do not create passwords directly in PostgreSQL or store them in `public.profiles`.

## Face login and staff attendance

Apply `202608260001_staff_faces_attendance.sql` before enabling face login. Existing accounts are promoted to owner accounts; staff registered afterward receive the staff role.

Create and start the face service:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Set `SUPABASE_SECRET_KEY` only in the backend environment. Never add it to a `VITE_` variable or deploy it with the browser application. Set `FRONTEND_ORIGIN` to the frontend origin; multiple origins may be comma-separated.

Owners can open **Admin settings → Staff & Attendance** to register a staff name, username, and live face. The service retains only the ArcFace embedding in the protected `face_credentials` table, not the captured photograph. A successful face login opens an attendance session, and logout closes it. Owner recovery login remains available for camera or model outages.

## Verification

```bash
npm run lint
npm run test
npm run build
```

## ICE pricing

The configured initial tiers are:

- 1-9 kg: PHP 15 per kg
- 20-29 kg: PHP 13 per kg

Weights without an active matching tier are rejected. Add future ranges through Settings. Active tiers cannot overlap, and checkout revalidates the matching tier and total in PostgreSQL.

## Production deployment on Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Select the Vite framework preset.
3. Keep the build command as `npm run build` and output directory as `dist`.
4. Add both `VITE_SUPABASE_*` variables in Vercel project settings.
5. Add the Vercel production URL to the Supabase Auth URL configuration.
6. Deploy over HTTPS. The committed `vercel.json` supplies the React Router fallback and security headers.

## Security notes

- React route protection is for navigation UX; Supabase RLS and authorized RPCs enforce database access.
- The browser never submits an authoritative price or total.
- Checkout is atomic and protected by a unique checkout key against duplicate completion.
- Historical order items store product, category, and price snapshots.
- Product deletion is archival; completed orders can be permanently deleted only through the password-confirmed owner workflow.
- Cart selections remain in browser memory and are written to PostgreSQL only after Complete Order is confirmed.
- Cash tendered and change use integer centavos. GCash checkout does not accept a cash amount.

## Manual checks

Before production, verify login/logout, protected routes, product creation/editing/archival, image upload/replacement, availability, ICE tier gaps, normal and ICE checkout, Cash change, GCash checkout, duplicate-click protection, order deletion confirmation, daily sales filtering, offline indication, and Vercel route refreshes.

## Troubleshooting

- Environment error: copy `.env.example` to `.env.local`, enter both project values, and restart Vite.
- Login denied: confirm the Auth user email follows the username mapping and its profile is active.
- Database RPC returns 404: apply all migrations in order, then reload the Supabase schema cache or wait briefly for it to refresh.
- Product image fails: confirm the `product-images` bucket policies exist and use JPEG, PNG, or WEBP files no larger than 5 MB.
- Checkout fails: confirm migration `202608250012_order_payments.sql` is applied and the selected products and ICE tier remain available.
