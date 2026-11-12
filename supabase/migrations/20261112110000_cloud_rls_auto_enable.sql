-- Step 3.1 · The project in the cloud was created with "Enable automatic RLS", which adds the event
-- trigger function public.rls_auto_enable(). Being in the public schema, the Data API exposes it
-- as an RPC that anyone may call (the security advisor warns of it): only its event trigger needs
-- it. It does not exist in a local Supabase, so this does nothing there.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
