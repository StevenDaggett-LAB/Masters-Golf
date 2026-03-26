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

5. Add approved players to `approved_users` table (example):

   ```sql
   insert into public.approved_users (full_name)
   values ('Tiger Woods'), ('Rory McIlroy');
   ```

6. Run the app:

   ```bash
   npm run dev
   ```

## Registration flow notes

- `/join` submits to `POST /api/join`.
- Full names are normalized with case-insensitive matching before checking `approved_users`.
- A UUID is generated in PostgreSQL for each user record.
- Admin route protection is currently a placeholder middleware check for an `admin_token` cookie.
