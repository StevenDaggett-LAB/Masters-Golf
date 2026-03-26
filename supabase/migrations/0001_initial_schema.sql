-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  team_name text not null,
  phone text,
  email text unique,
  pin_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.approved_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null
);

create unique index if not exists approved_users_full_name_lower_idx
  on public.approved_users ((lower(full_name)));

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tier1 text,
  tier2 text,
  tier3 text,
  tier4 text,
  tier5 text,
  tier6 text,
  updated_at timestamptz not null default now(),
  is_locked boolean not null default false
);

create table if not exists public.tiers (
  id uuid primary key default gen_random_uuid(),
  tier_number int not null check (tier_number between 1 and 6),
  golfer_name text not null,
  odds text
);

create table if not exists public.settings (
  id int primary key default 1,
  draft_locked boolean not null default false,
  draft_open boolean not null default false,
  lock_time timestamptz
);

insert into public.settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  golfer_name text not null,
  round int not null check (round between 1 and 4),
  score int,
  birdies int
);
