-- Make the deployed site safe to share.
--
-- Until now anyone reaching the database with the publishable key could write
-- to it, and that key ships in the browser bundle, so it is discoverable by
-- anyone who opens devtools. On a public URL that means a stranger could
-- delete the library.
--
-- After this migration the anonymous role can read and nothing else. Writes go
-- through the server using the service role key, which never leaves the server
-- and is only used once the request has proved it holds the unlock cookie.

-- ---------------------------------------------------------------------------
-- 1. Anonymous access is read-only.
-- ---------------------------------------------------------------------------
drop policy if exists recipes_open       on public.recipes;
drop policy if exists pantry_open        on public.pantry_items;
drop policy if exists taste_profile_open on public.taste_profile;

create policy recipes_read on public.recipes
  for select using (true);

-- No insert, update or delete policy: with RLS on, the absence of a policy is
-- a denial. The service role bypasses RLS entirely, which is how writes work.

-- ---------------------------------------------------------------------------
-- 2. Daily generation counter for visitors.
--
-- Has to be in the database rather than in memory: serverless instances are
-- recycled constantly, so an in-process counter resets on every cold start and
-- caps nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.usage_counter (
  day   date primary key default current_date,
  count integer not null default 0
);

alter table public.usage_counter enable row level security;
-- Readable so the page can show how many are left. Only the server writes.
create policy usage_read on public.usage_counter
  for select using (true);

/**
 * Increment today's counter and return the new total, atomically.
 *
 * A read-then-write from the application would race between concurrent
 * requests and let the cap drift past its limit under load.
 */
create or replace function public.bump_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.usage_counter (day, count)
  values (current_date, 1)
  on conflict (day) do update set count = public.usage_counter.count + 1
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.bump_usage() from public, anon;

/** Today's count, without incrementing. */
create or replace function public.usage_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select count from public.usage_counter where day = current_date), 0);
$$;

grant execute on function public.usage_today() to anon;
