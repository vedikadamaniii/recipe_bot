-- Remove authentication: this is a single-owner app.
--
-- Everything previously hung off auth.users and auth.uid(). With no sign-in
-- there is no auth.uid(), so the foreign keys and the row-level security
-- policies would reject every read and write. This migration re-points the
-- tables at one fixed owner id and opens access to the anonymous role.
--
-- TRADE-OFF, stated plainly: after this, anyone who can reach the database
-- through the publishable key can read and write these tables. That is fine
-- while the app runs locally. Before putting it on a public URL, either put
-- the deployment behind a password or restore 0001's policies.
--
-- The user_id column is kept rather than dropped so that adding auth back
-- later is a migration, not a rewrite.

-- The single owner. Any fixed UUID works; this one is arbitrary.
-- Keep it in sync with OWNER_ID in lib/owner.ts.
do $$
declare
  owner constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  -- 1. Drop the foreign keys into auth.users.
  alter table public.recipes       drop constraint if exists recipes_user_id_fkey;
  alter table public.pantry_items  drop constraint if exists pantry_items_user_id_fkey;
  alter table public.taste_profile drop constraint if exists taste_profile_user_id_fkey;

  -- 2. Default every row to the single owner.
  execute format('alter table public.recipes       alter column user_id set default %L', owner);
  execute format('alter table public.pantry_items  alter column user_id set default %L', owner);
  execute format('alter table public.taste_profile alter column user_id set default %L', owner);

  -- 3. Re-home anything already saved under a real auth user.
  update public.recipes       set user_id = owner where user_id <> owner;
  update public.pantry_items  set user_id = owner where user_id <> owner;
  update public.taste_profile set user_id = owner where user_id <> owner;

  -- 4. Make sure the taste profile row exists, since nothing seeds it now.
  insert into public.taste_profile (user_id) values (owner)
    on conflict (user_id) do nothing;
end $$;

-- 5. The signup trigger has nothing left to hang off.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 6. Replace the own-rows-only policies with open access for the anon role.
--    Enabling RLS with no matching policy denies everything, so each table
--    needs an explicit permissive policy rather than simply having RLS off.
drop policy if exists taste_profile_select on public.taste_profile;
drop policy if exists taste_profile_insert on public.taste_profile;
drop policy if exists taste_profile_update on public.taste_profile;
drop policy if exists recipes_select on public.recipes;
drop policy if exists recipes_insert on public.recipes;
drop policy if exists recipes_update on public.recipes;
drop policy if exists recipes_delete on public.recipes;
drop policy if exists pantry_select on public.pantry_items;
drop policy if exists pantry_insert on public.pantry_items;
drop policy if exists pantry_update on public.pantry_items;
drop policy if exists pantry_delete on public.pantry_items;

drop policy if exists taste_profile_open on public.taste_profile;
create policy taste_profile_open on public.taste_profile
  for all using (true) with check (true);

drop policy if exists recipes_open on public.recipes;
create policy recipes_open on public.recipes
  for all using (true) with check (true);

drop policy if exists pantry_open on public.pantry_items;
create policy pantry_open on public.pantry_items
  for all using (true) with check (true);
