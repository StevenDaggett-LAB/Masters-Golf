alter table public.golfer_scores
add column if not exists status_text text,
add column if not exists current_round_score int;
