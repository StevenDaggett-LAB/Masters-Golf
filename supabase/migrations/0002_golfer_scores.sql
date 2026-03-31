create table if not exists public.golfer_scores (
  id uuid primary key default gen_random_uuid(),
  golfer_name text not null unique,
  total_score int not null default 0,
  made_cut boolean not null default true,
  round_1_score int,
  round_2_score int,
  round_3_score int,
  round_4_score int,
  sunday_birdies int not null default 0,
  updated_at timestamptz not null default now()
);
