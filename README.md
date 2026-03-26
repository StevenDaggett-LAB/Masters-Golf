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
- Manual seed scripts:
  - `supabase/seeds/approved_users.sql`
  - `supabase/seeds/tiers.sql`
- Working navigation:
  - Landing page (`/`)
  - Join page (`/join`)
  - Pre-draft lobby (`/lobby`)
  - Draft page (`/draft`)
  - Protected admin tier page (`/admin`)

> Scoring and public reveal logic are intentionally not implemented yet.

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

5. Seed approved users and tiers (for local testing):

   ```sql
   -- run supabase/seeds/approved_users.sql
   -- run supabase/seeds/tiers.sql
   ```

6. Run the app:

   ```bash
   npm run dev
   ```

## Registration + session flow

- `/join` submits to `POST /api/join` with required full/team names and optional phone/email.
- Full names are normalized and validated against `approved_users` case-insensitively.
- Non-approved users are blocked with:
  - `You are not on the approved list. Please contact the admin.`
- User ID is persisted in localStorage and returning users skip the join form.

## Draft flow

- `/lobby` reads `settings` via API.
- When draft is open (`draft_open = true` and `draft_locked = false`), lobby links directly to `/draft`.
- `/draft` loads:
  - settings
  - grouped golfers from `tiers`
  - existing team for current user
- Users select one golfer from each of tiers 1–6 and click **Save Team**.
- Save behavior:
  - validates all six picks exist
  - updates existing team row (or inserts if missing)
  - blocks exact 6/6 duplicates across other users with message:
    - `This exact team has already been taken. Please change at least one golfer.`
- If draft is closed or locked, draft UI is read-only.

## Admin tier management

- `/admin` includes editable grouped sections for tiers 1–6.
- Each line uses: `Golfer Name | Odds`.
- Save replaces rows in `tiers` table so admins can quickly manage draft options.
