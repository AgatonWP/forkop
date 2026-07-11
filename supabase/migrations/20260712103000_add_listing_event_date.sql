alter table public.listings
  add column if not exists event_date date;
