-- Manual approved user seed data for local/dev setup.
insert into public.approved_users (full_name)
values
  ('Tiger Woods'),
  ('Rory McIlroy'),
  ('Scottie Scheffler'),
  ('Nelly Korda')
on conflict do nothing;
