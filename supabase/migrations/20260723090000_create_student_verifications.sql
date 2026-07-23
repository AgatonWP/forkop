-- "Verifierad student": prove ownership of an @lu.se email via a 6-digit
-- code, then show a blue checkmark on the profile/listings. Client code
-- can't write auth.users directly in a supported way, so this migration
-- only ever touches this new table; the actual auth.users.user_metadata
-- write happens in the apply-student-verification Edge Function via the
-- Admin API, which re-checks consumed_at itself before writing.
--
-- Run this once in the Supabase SQL editor (no linked Supabase CLI
-- project in this repo, so it isn't applied automatically).

-- digest()/sha256 lives in pgcrypto, unlike gen_random_uuid() which is
-- built into Postgres core - must be created explicitly.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.student_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lu_email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists student_verifications_user_id_created_at_idx
  on public.student_verifications (user_id, created_at desc);

-- One @lu.se address can only ever verify one account.
create unique index if not exists student_verifications_lu_email_consumed_idx
  on public.student_verifications (lower(lu_email))
  where consumed_at is not null;

alter table public.student_verifications enable row level security;

drop policy if exists "Users can view their own verification requests" on public.student_verifications;
create policy "Users can view their own verification requests"
  on public.student_verifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies: all writes go through the
-- security-definer functions below, never directly from the client.

create or replace function public.request_student_verification(lu_email text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(lu_email));
  v_code text;
  v_recent_count int;
  v_daily_count int;
begin
  if not (v_email ~* '^[^\s@]+@lu\.se$') then
    raise exception 'Ange en giltig @lu.se-mejladress.';
  end if;

  if exists (
    select 1 from public.student_verifications
    where lower(lu_email) = v_email
      and consumed_at is not null
      and user_id <> auth.uid()
  ) then
    raise exception 'Den här mejladressen är redan kopplad till ett annat konto.';
  end if;

  select count(*) into v_recent_count from public.student_verifications
    where user_id = auth.uid()
      and consumed_at is null
      and created_at > now() - interval '60 seconds';
  if v_recent_count > 0 then
    raise exception 'Vänta en liten stund innan du begär en ny kod.';
  end if;

  select count(*) into v_daily_count from public.student_verifications
    where user_id = auth.uid()
      and created_at > now() - interval '24 hours';
  if v_daily_count >= 10 then
    raise exception 'Du har nått dagens gräns för antal verifieringsförsök. Försök igen imorgon.';
  end if;

  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into public.student_verifications (user_id, lu_email, code_hash, expires_at)
  values (auth.uid(), v_email, encode(digest(v_code, 'sha256'), 'hex'), now() + interval '10 minutes');

  return v_code;
end;
$$;

grant execute on function public.request_student_verification(text) to authenticated;

create or replace function public.verify_student_code(code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.student_verifications%rowtype;
begin
  select * into v_row from public.student_verifications
    where user_id = auth.uid()
    order by created_at desc
    limit 1;

  if v_row.id is null or v_row.consumed_at is not null then
    raise exception 'Ingen väntande verifiering. Begär en ny kod.';
  end if;

  if v_row.expires_at < now() then
    raise exception 'Koden har gått ut. Begär en ny kod.';
  end if;

  if v_row.attempts >= 5 then
    raise exception 'För många felaktiga försök. Begär en ny kod.';
  end if;

  update public.student_verifications
    set attempts = attempts + 1
    where id = v_row.id;

  if v_row.code_hash <> encode(digest(btrim(code), 'sha256'), 'hex') then
    raise exception 'Fel kod. Försök igen.';
  end if;

  begin
    update public.student_verifications
      set consumed_at = now()
      where id = v_row.id;
  exception
    when unique_violation then
      -- Same email already consumed by this user in an earlier request
      -- (e.g. re-verifying after re-requesting a code) is a harmless
      -- no-op; a different user owning that email is a real conflict.
      if exists (
        select 1 from public.student_verifications
        where lower(lu_email) = v_row.lu_email
          and consumed_at is not null
          and user_id = auth.uid()
      ) then
        return;
      end if;

      raise exception 'Den här mejladressen är redan kopplad till ett annat konto.';
  end;
end;
$$;

grant execute on function public.verify_student_code(text) to authenticated;
