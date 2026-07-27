-- The function argument is also named lu_email. Qualify table columns so
-- Postgres never has to choose between the argument and the column.

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
  if not (v_email ~* '^[^[:space:]@]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*lu\.se$') then
    raise exception 'Ange en giltig LU-mejladress.';
  end if;

  if exists (
    select 1
    from public.student_verifications as sv
    where lower(sv.lu_email) = v_email
      and sv.consumed_at is not null
      and sv.user_id <> auth.uid()
  ) then
    raise exception 'Den här mejladressen är redan kopplad till ett annat konto.';
  end if;

  select count(*)
  into v_recent_count
  from public.student_verifications as sv
  where sv.user_id = auth.uid()
    and sv.consumed_at is null
    and sv.created_at > now() - interval '60 seconds';
  if v_recent_count > 0 then
    raise exception 'Vänta en liten stund innan du begär en ny kod.';
  end if;

  select count(*)
  into v_daily_count
  from public.student_verifications as sv
  where sv.user_id = auth.uid()
    and sv.created_at > now() - interval '24 hours';
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

notify pgrst, 'reload schema';
