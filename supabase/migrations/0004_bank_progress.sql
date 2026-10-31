-- ═══════════════════════════════════════════════════════════════════════════
-- Plumi website — self-marking in the question bank, kept in the student's account
--
-- Runs in the APP's Supabase project (the one the iPad signs into), not the
-- waitlist's: website accounts are Plumi accounts. It adds two tables and touches
-- nothing that exists.
--
--   bank_attempt  one row per mark a student gives themselves on a bank question:
--                 the part (its id in the website's bank, e.g. "74051-jun25-01-4"),
--                 its subject bank and topic codes, the score out of the marks, the
--                 letter picked for multiple choice ("~" for a rough Got it / Partly /
--                 Missed, whose 2 is not a printed mark), and when.
--   bank_prefs    the banks a student has said they take ("My subjects").
--
-- Read and written straight from the browser with the publishable key, as the
-- signed-in student (src/lib/bankSync.ts). So the security model is row-level
-- security: a student sees and changes only their own rows, and nobody signed out
-- sees anything. Deleting the account (delete_own_account) deletes the rows.
--
-- Run it once, in the Supabase SQL editor. Re-runs cleanly. Already run on the app's
-- project (October 2026). The other files here (0001 to 0003) are the waitlist's.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.bank_attempt (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  part_id     text not null check (char_length(part_id) between 1 and 80),
  subject     text not null check (char_length(subject) between 1 and 80),
  topics      text[] not null default '{}' check (cardinality(topics) <= 12),
  score       smallint not null check (score >= 0),
  out_of      smallint not null check (out_of between 1 and 100),
  pick        text check (pick is null or char_length(pick) <= 8),
  at          timestamptz not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, part_id, at),
  check (score <= out_of)
);
create index if not exists bank_attempt_user_subject on public.bank_attempt (user_id, subject);

create table if not exists public.bank_prefs (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  subjects    text[] not null default '{}' check (cardinality(subjects) <= 60),
  updated_at  timestamptz not null default now()
);

alter table public.bank_attempt enable row level security;
alter table public.bank_prefs enable row level security;

-- Signed-in students only, and only their own rows.
revoke all on public.bank_attempt, public.bank_prefs from anon;
grant select, insert, update, delete on public.bank_attempt, public.bank_prefs to authenticated;

drop policy if exists bank_attempt_own on public.bank_attempt;
create policy bank_attempt_own on public.bank_attempt
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists bank_prefs_own on public.bank_prefs;
create policy bank_prefs_own on public.bank_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
