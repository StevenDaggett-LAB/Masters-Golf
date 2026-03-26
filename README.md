# Masters Golf Pool (Next.js + Supabase)

Private golf pool starter app built with the Next.js App Router and a Supabase backend.

## Included in this setup

- Next.js App Router structure
- Supabase integration scaffolding (`lib/supabase.ts`)
- Environment variable support (`lib/env.ts`, `.env.example`)
- Simple green themed UI
- Database schema migration for:
  - `users`
  - `approved_users`
  - `teams`
  - `tiers`
  - `settings`
  - `scores`
- Manual approved-user seed script (`supabase/seeds/approved_users.sql`)
- Working navigation:
  - Landing page (`/`)
  - Join page (`/join`)
  - Pre-draft lobby (`/lobby`)
  - Protected admin placeholder (`/admin`)

> Drafting and scoring logic are intentionally not implemented yet.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `.env.local` with your Supabase project values.

4. Apply database schema:

   - Option A: Paste `supabase/migrations/0001_initial_schema.sql` into Supabase SQL Editor and run it.
   - Option B: If you use the Supabase CLI locally, add this migration and run your normal migration flow.

5. Seed approved users manually (required for join validation):

   ```sql
   -- run supabase/seeds/approved_users.sql
   insert into public.approved_users (full_name)
   values ('Tiger Woods'), ('Rory McIlroy')
   on conflict do nothing;
   ```

6. Run the app:

   ```bash
   npm run dev
   ```

## Registration + lobby flow

- `/join` submits to `POST /api/join` and requires:
  - Full Name (required)
  - Team Name (required)
  - Phone (optional)
  - Email (optional)
- Names are normalized and validated against `approved_users` using a case-insensitive check.
- If the name is not approved, registration is blocked with:
  - `You are not on the approved list. Please contact the admin.`
- Duplicate registrations are prevented by unique `approved_user_id` linkage in `users`.
- On success, `userId` is stored in localStorage and the user is redirected to `/lobby`.
- Returning users with a stored `userId` skip the join form.
- `/lobby` fetches `settings` and, when `draft_locked = true`, shows a countdown to:
  - April 8, 2026 at 8:00 PM America/Los_Angeles
