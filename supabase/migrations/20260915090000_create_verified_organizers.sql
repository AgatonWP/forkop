-- Verified organizer accounts: lets a nation (or other organizer) run an
-- official account whose listings carry a verified badge. An admin grants it
-- manually, after confirming with the organizer through contact details
-- published on the organizer's own website. Run this once in the Supabase
-- SQL editor.

create table if not exists public.verified_organizers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organizer_id text not null check (organizer_id <> 'other'),
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users (id) on delete set null
);

create index if not exists verified_organizers_organizer_id_idx
  on public.verified_organizers (organizer_id);

alter table public.verified_organizers enable row level security;

-- Public by design: the badge has to show to everyone, including signed-out
-- visitors, and listings already expose user_id.
grant select on public.verified_organizers to anon, authenticated;

drop policy if exists "Verified organizers are publicly readable" on public.verified_organizers;
create policy "Verified organizers are publicly readable"
  on public.verified_organizers
  for select
  to anon, authenticated
  using (true);

-- Deliberately no insert/update/delete grant or policy. The admin functions
-- below are the only write path, which is what stops users verifying
-- themselves. Never mirror this flag onto listings or user_metadata: both are
-- written by the client.

create or replace function public.admin_verify_organizer(p_email text, p_organizer_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'no account with that email';
  end if;

  insert into public.verified_organizers (user_id, organizer_id, verified_by)
  values (v_user_id, p_organizer_id, (select auth.uid()))
  on conflict (user_id) do update
    set organizer_id = excluded.organizer_id,
        verified_at = now(),
        verified_by = excluded.verified_by;

  return v_user_id;
end;
$$;

create or replace function public.admin_revoke_organizer(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.verified_organizers where user_id = p_user_id;
end;
$$;

-- Admin view with emails, which the public table intentionally doesn't expose.
create or replace function public.admin_list_verified_organizers()
returns table (user_id uuid, email text, organizer_id text, verified_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select v.user_id, u.email::text, v.organizer_id, v.verified_at
    from public.verified_organizers v
    join auth.users u on u.id = v.user_id
    order by v.organizer_id;
end;
$$;

revoke all on function public.admin_verify_organizer(text, text) from public, anon;
revoke all on function public.admin_revoke_organizer(uuid) from public, anon;
revoke all on function public.admin_list_verified_organizers() from public, anon;
grant execute on function public.admin_verify_organizer(text, text) to authenticated;
grant execute on function public.admin_revoke_organizer(uuid) to authenticated;
grant execute on function public.admin_list_verified_organizers() to authenticated;
