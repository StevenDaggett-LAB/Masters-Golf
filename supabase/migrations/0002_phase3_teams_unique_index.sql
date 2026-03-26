-- Phase 3: ensure each user has a single team row for update-in-place behavior.
create unique index if not exists teams_user_id_unique_idx on public.teams(user_id);
