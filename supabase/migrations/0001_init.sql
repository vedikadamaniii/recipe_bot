-- Recipe Bot: initial schema.
--
-- This repo and the deployed URL are both public, so row-level security is not
-- optional here: it is the only thing standing between a stranger who signs up
-- and your recipe library. Every table below denies access by default and is
-- then opened up only to rows the requesting user owns.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Taste profile: one row per user. This is the ChatGPT context, made editable.
-- ---------------------------------------------------------------------------
create table if not exists public.taste_profile (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  summary     text        not null default '',
  allergies   text[]      not null default '{}',
  dislikes    text[]      not null default '{}',
  spice_level text        check (spice_level in ('mild', 'medium', 'hot')),
  equipment   text[]      not null default '{}',
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recipes.
--
-- ingredients and steps are jsonb rather than separate tables: they are nested,
-- always read as part of a whole recipe, and never queried across recipes.
-- Normalising them would turn every single read into a multi-table join and buy
-- nothing in return.
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  description    text,
  cuisine        text not null default 'Other',
  tags           text[] not null default '{}',
  ingredients    jsonb  not null default '[]'::jsonb,
  steps          jsonb  not null default '[]'::jsonb,
  -- The divisor for all portion scaling, so it must be sane.
  base_servings  integer not null default 2 check (base_servings > 0),
  total_time_min integer check (total_time_min is null or total_time_min > 0),
  source_type    text not null default 'manual'
                 check (source_type in ('generated', 'image', 'link', 'manual')),
  source_url     text,
  image_url      text,
  rating         smallint check (rating is null or rating between 1 and 5),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Browsing is by cuisine and by tag, which is what these support.
create index if not exists recipes_user_created_idx
  on public.recipes (user_id, created_at desc);
create index if not exists recipes_user_cuisine_idx
  on public.recipes (user_id, cuisine);
create index if not exists recipes_tags_idx
  on public.recipes using gin (tags);
-- Text search across title and description for the library search box.
create index if not exists recipes_search_idx
  on public.recipes using gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  );

-- ---------------------------------------------------------------------------
-- Pantry.
-- ---------------------------------------------------------------------------
create table if not exists public.pantry_items (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  name     text not null,
  qty      numeric,
  unit     text,
  category text,
  added_at timestamptz not null default now(),
  -- The same ingredient should not appear twice in one pantry.
  unique (user_id, name)
);

create index if not exists pantry_user_idx on public.pantry_items (user_id);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest without relying on the application to remember.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipes_touch_updated_at on public.recipes;
create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function public.touch_updated_at();

drop trigger if exists taste_profile_touch_updated_at on public.taste_profile;
create trigger taste_profile_touch_updated_at
  before update on public.taste_profile
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security.
--
-- Enabling RLS without a policy denies everything, which is the correct
-- starting point. Each policy below then grants access to own rows only.
-- `with check` on insert/update is what stops a user writing a row owned by
-- somebody else.
-- ---------------------------------------------------------------------------
alter table public.taste_profile enable row level security;
alter table public.recipes       enable row level security;
alter table public.pantry_items  enable row level security;

drop policy if exists taste_profile_select on public.taste_profile;
create policy taste_profile_select on public.taste_profile
  for select using ((select auth.uid()) = user_id);

drop policy if exists taste_profile_insert on public.taste_profile;
create policy taste_profile_insert on public.taste_profile
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists taste_profile_update on public.taste_profile;
create policy taste_profile_update on public.taste_profile
  for update using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes
  for select using ((select auth.uid()) = user_id);

drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert on public.recipes
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists recipes_update on public.recipes;
create policy recipes_update on public.recipes
  for update using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

drop policy if exists recipes_delete on public.recipes;
create policy recipes_delete on public.recipes
  for delete using ((select auth.uid()) = user_id);

drop policy if exists pantry_select on public.pantry_items;
create policy pantry_select on public.pantry_items
  for select using ((select auth.uid()) = user_id);

drop policy if exists pantry_insert on public.pantry_items;
create policy pantry_insert on public.pantry_items
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists pantry_update on public.pantry_items;
create policy pantry_update on public.pantry_items
  for update using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

drop policy if exists pantry_delete on public.pantry_items;
create policy pantry_delete on public.pantry_items
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Give every new user an empty taste profile so the settings page always has a
-- row to edit.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.taste_profile (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
