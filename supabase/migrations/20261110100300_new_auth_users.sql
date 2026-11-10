-- Step 2.1 · Every new Supabase Auth user gets their `app_user` row, always as a student.
--
-- The role is never taken from the metadata, which the user can edit themselves: the administrator
-- changes it afterwards (Edge Function `admin-users`, phase 5). The name may come from the
-- metadata, since it is only shown; without one, the part of the email before the @.
create function public.create_app_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_user (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

revoke execute on function public.create_app_user() from public, anon, authenticated;

create trigger create_app_user
after insert on auth.users
for each row execute function public.create_app_user();
