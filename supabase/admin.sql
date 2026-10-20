-- SWABUD admin panel: who is an admin, the opportunities table the panel publishes to, and the security rules.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run. Safe to run again.
-- Then add your own login email at the bottom (step 4) and open https://swabud.tech/admin.html

-- ---------------------------------------------------------------- 1. admins
-- Only emails in this list can use the admin panel. Manage the list here in SQL; the website can't change it.
create table if not exists public.admins (
  email     text primary key check (email = lower(email) and email like '%@%'),
  added_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- true when the signed-in person's email is in public.admins
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------- 2. opportunities published from the admin panel
-- status: draft (only admins see it), published (live on the site), removed (taken off the site).
-- The site shows published rows straight away; a GitHub Action also copies them into
-- _source/data/opportunities.json every 30 minutes and rebuilds the static pages.
create table if not exists public.opportunities (
  slug          text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title         text not null check (char_length(title) between 3 and 140),
  category      text not null check (category in ('hackathons', 'ctf', 'internships', 'scholarships', 'events', 'courses', 'volunteering', 'programs')),
  organizer     text not null default '' check (char_length(organizer) <= 160),
  summary       text not null default '' check (char_length(summary) <= 1200),
  who           text not null default '' check (char_length(who) <= 800),
  mode          text not null default 'Online' check (char_length(mode) <= 60),
  location      text not null default '' check (char_length(location) <= 160),
  region        text not null default 'online' check (region in ('nepal', 'online', 'abroad')),
  dates         text not null default '' check (char_length(dates) <= 400),
  when_text     text not null default '' check (char_length(when_text) <= 120),
  opens         date,
  deadline      date,
  start_date    date,
  end_date      date,
  base          text not null default 'open' check (base in ('open', 'upcoming', 'rolling', 'recurring', 'closed')),
  cost          text not null default '' check (char_length(cost) <= 160),
  free          boolean not null default false,
  benefits      text not null default '' check (char_length(benefits) <= 600),
  level         text not null default 'All levels' check (char_length(level) <= 40),
  link          text not null check ((link ~* '^https?://' or link ~ '^[a-z0-9/#._-]+$') and char_length(link) <= 500),
  verified      date,
  steps         jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  notes         text not null default '' check (char_length(notes) <= 800),
  status        text not null default 'draft' check (status in ('draft', 'published', 'removed')),
  submission_id bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists opportunities_status_idx on public.opportunities (status, updated_at desc);

-- keep updated_at and updated_by right on every change
create or replace function public.opportunities_touch()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := lower(coalesce((select auth.jwt()) ->> 'email', new.updated_by, ''));
  if tg_op = 'INSERT' then new.created_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists opportunities_touch on public.opportunities;
create trigger opportunities_touch
  before insert or update on public.opportunities
  for each row execute procedure public.opportunities_touch();

alter table public.opportunities enable row level security;
drop policy if exists "opportunities public read" on public.opportunities;
drop policy if exists "opportunities admin read"  on public.opportunities;
drop policy if exists "opportunities admin insert" on public.opportunities;
drop policy if exists "opportunities admin update" on public.opportunities;
drop policy if exists "opportunities admin delete" on public.opportunities;
-- everyone (signed in or not) can read what is published or removed, so the site can show and hide listings
create policy "opportunities public read" on public.opportunities for select to anon, authenticated
  using (status in ('published', 'removed'));
-- admins can read drafts and change everything
create policy "opportunities admin read"   on public.opportunities for select to authenticated using ((select public.is_admin()));
create policy "opportunities admin insert" on public.opportunities for insert to authenticated with check ((select public.is_admin()));
create policy "opportunities admin update" on public.opportunities for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "opportunities admin delete" on public.opportunities for delete to authenticated using ((select public.is_admin()));

grant select on public.opportunities to anon, authenticated;
grant insert, update, delete on public.opportunities to authenticated;
grant select on public.admins to authenticated;

-- ---------------------------------------------------------------- 3. submissions inbox for admins
-- Students' "Submit an opportunity" entries: admins can read them all and set published / declined.
drop policy if exists "submissions admin read"   on public.submissions;
drop policy if exists "submissions admin update" on public.submissions;
create policy "submissions admin read"   on public.submissions for select to authenticated using ((select public.is_admin()));
create policy "submissions admin update" on public.submissions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, update on public.submissions to authenticated;

-- ---------------------------------------------------------------- 4. add yourself as an admin
-- Use the exact email you log in to swabud.tech with (Google or email). Add one line per admin.
insert into public.admins (email) values ('info@swabud.tech') on conflict do nothing;
-- insert into public.admins (email) values ('your.login.email@gmail.com') on conflict do nothing;

-- To remove an admin:
--   delete from public.admins where email = 'someone@example.com';
