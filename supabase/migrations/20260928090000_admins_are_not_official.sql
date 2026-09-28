-- An account is either an admin or an official account, with one deliberate
-- exception. Run this once in the Supabase SQL editor.
--
-- The two are different jobs. An admin reads reports, sees every listing and
-- can delete anyone's; an official account sells tickets with a badge and
-- higher limits. Keeping them apart means the account that moderates is not
-- also the account that trades, so nobody can quietly clear a report about
-- their own listing, and losing the password to a selling account does not
-- hand over moderation.
--
-- The exception is Förköp's own account, which does both on purpose. It is
-- marked on the admin row rather than hidden in a function, so the answer to
-- "who is allowed to be both?" is a select away:
--
--   select * from public.admins where may_sell_officially;
--
-- Enforced twice over: a trigger on each table refuses the combination, and
-- is_admin() ignores an account that is listed as official without the mark.
-- The second is there in case a row is ever added straight in the SQL editor,
-- where triggers are the only thing standing in the way.

alter table public.admins
  add column if not exists may_sell_officially boolean not null default false;

comment on column public.admins.may_sell_officially is
  'Set only for Förköp''s own account: lets this admin also be an official account.';

create or replace function public.forbid_admin_and_official()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'official_accounts' then
    if exists (
      select 1 from public.admins a
      where a.user_id = new.user_id and not a.may_sell_officially
    ) then
      raise exception 'Kontot är admin och kan därför inte vara ett officiellt konto.'
        using errcode = '23W09';
    end if;
  else
    if not new.may_sell_officially
       and exists (select 1 from public.official_accounts o where o.user_id = new.user_id) then
      raise exception 'Kontot är ett officiellt konto och kan därför inte vara admin.'
        using errcode = '23W09';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists official_accounts_not_admin on public.official_accounts;
create trigger official_accounts_not_admin
  before insert or update of user_id on public.official_accounts
  for each row
  execute function public.forbid_admin_and_official();

drop trigger if exists admins_not_official on public.admins;
create trigger admins_not_official
  before insert or update of user_id, may_sell_officially on public.admins
  for each row
  execute function public.forbid_admin_and_official();

-- Should both rows ever exist without the mark, the admin rights are the ones
-- that go: they are the dangerous half. Fix such a case in the SQL editor by
-- removing one row or setting the mark; the app cannot, since it would need
-- the admin rights it just lost.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
      and (
        a.may_sell_officially
        or not exists (select 1 from public.official_accounts o where o.user_id = a.user_id)
      )
  );
$$;

do $$
declare
  conflicts int;
begin
  select count(*) into conflicts
  from public.admins a
  join public.official_accounts o on o.user_id = a.user_id
  where not a.may_sell_officially;

  if conflicts > 0 then
    raise warning 'Det finns % konto(n) som är både admin och officiellt konto utan undantag. De har förlorat sin adminbehörighet tills en av raderna tas bort eller may_sell_officially sätts.', conflicts;
  end if;
end $$;
