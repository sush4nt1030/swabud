-- SWABUD accounts: tables, security rules and the new-user trigger.
-- Run in Supabase: SQL Editor > New query > paste this file > Run.
-- Safe to run again: re-running it upgrades an existing project (v4 adds learn_progress and checklist).

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 80),
  avatar_url  text,
  college     text check (char_length(college) <= 120),
  programme   text check (char_length(programme) <= 80),
  city        text check (char_length(city) <= 60),
  region      text not null default '' check (region in ('', 'nepal', 'online', 'abroad')),
  interests   text[] not null default '{}',
  alerts      boolean not null default false,
  learn_progress jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Saved opportunities and the application tracker (one row per user and listing)
create table if not exists public.saved (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug        text not null check (char_length(slug) between 1 and 120),
  status      text not null default 'saved' check (status in ('saved', 'preparing', 'applied', 'accepted', 'rejected')),
  note        text not null default '' check (char_length(note) <= 1000),
  checklist   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, slug)
);

-- Opportunities submitted from profiles. Review them in Table Editor and set status to
-- 'published' or 'declined'; the submitter sees the new status in their profile.
create table if not exists public.submissions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title          text not null check (char_length(title) <= 140),
  category       text not null check (char_length(category) <= 60),
  organizer      text not null check (char_length(organizer) <= 120),
  official_link  text not null check (official_link ~* '^https?://' and char_length(official_link) <= 500),
  opens          date,
  deadline       date,
  start_date     date,
  end_date       date,
  format         text check (char_length(format) <= 40),
  location       text check (char_length(location) <= 100),
  cost           text check (char_length(cost) <= 100),
  level          text check (char_length(level) <= 40),
  who_can_apply  text check (char_length(who_can_apply) <= 200),
  description    text check (char_length(description) <= 1500),
  relationship   text check (char_length(relationship) <= 60),
  contact_name   text check (char_length(contact_name) <= 80),
  contact_email  text check (char_length(contact_email) <= 200),
  status         text not null default 'pending' check (status in ('pending', 'published', 'declined')),
  review_note    text,
  created_at     timestamptz not null default now()
);
create index if not exists submissions_user_idx on public.submissions (user_id, created_at desc);

-- v4 upgrade for projects created with an earlier version of this file
alter table public.profiles add column if not exists learn_progress jsonb not null default '{}'::jsonb;
alter table public.saved    add column if not exists checklist      jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------- row level security
-- Every signed-in person can only see and change their own rows. Visitors who aren't signed in see nothing.
alter table public.profiles    enable row level security;
alter table public.saved       enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "profiles read own"   on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read own"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "saved read own"   on public.saved;
drop policy if exists "saved insert own" on public.saved;
drop policy if exists "saved update own" on public.saved;
drop policy if exists "saved delete own" on public.saved;
create policy "saved read own"   on public.saved for select to authenticated using ((select auth.uid()) = user_id);
create policy "saved insert own" on public.saved for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saved update own" on public.saved for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saved delete own" on public.saved for delete to authenticated using ((select auth.uid()) = user_id);

-- Submitters can add (always as 'pending') and read their own submissions, but not change their status.
drop policy if exists "submissions read own"   on public.submissions;
drop policy if exists "submissions insert own" on public.submissions;
create policy "submissions read own"   on public.submissions for select to authenticated using ((select auth.uid()) = user_id);
create policy "submissions insert own" on public.submissions for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and review_note is null);

-- ---------------------------------------------------------------- new users get a profile automatically
-- Copies the name, Google photo and chosen interests from sign-up into public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, avatar_url, interests)
  values (
    new.id,
    left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 80),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture', ''),
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(
         case when jsonb_typeof(meta -> 'interests') = 'array' then meta -> 'interests' else '[]'::jsonb end) as t(x)),
      '{}'::text[])
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------- handy queries for the SWABUD team
-- Everyone who asked for the weekly roundup (run in SQL Editor, export as CSV):
--   select p.full_name, u.email, p.interests, p.city
--   from public.profiles p join auth.users u on u.id = p.id
--   where p.alerts order by u.created_at;
--
-- Submissions waiting for review:
--   select id, created_at, title, organizer, official_link, deadline, contact_email
--   from public.submissions where status = 'pending' order by created_at;
--
-- Most-saved listings (what students care about):
--   select slug, count(*) from public.saved group by slug order by count(*) desc limit 20;
