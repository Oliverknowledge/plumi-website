-- ═══════════════════════════════════════════════════════════════════════════
-- Plumi website — saved questions in the question bank, kept in the student's account
--
-- Runs in the APP's Supabase project (the one the iPad signs into), not the
-- waitlist's, as 0004 does. It adds one table and touches nothing that exists.
--
--   bank_saved  one row per part a student has bookmarked or written a note on:
--               the part (its id in the website's bank), its subject bank, whether
--               it's bookmarked, the note ('' for none), and when it last changed.
--               A row with no bookmark and no note is kept: it's how another device
--               learns something was taken off (the later updated_at wins).
--
-- Notes are a student's own words. Read and written straight from the browser with
-- the publishable key, as the signed-in student (src/lib/bankSync.ts), so the security
-- model is row-level security: a student sees and changes only their own rows, and
-- nobody signed out sees anything. Deleting the account deletes the rows.
--
-- Run it once, in the Supabase SQL editor. Re-runs cleanly.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.bank_saved (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  part_id     text not null check (char_length(part_id) between 1 and 80),
  subject     text not null check (char_length(subject) between 1 and 80),
  bookmarked  boolean not null default false,
  note        text not null default '' check (char_length(note) <= 2000),
  updated_at  timestamptz not null,
  primary key (user_id, part_id)
);

alter table public.bank_saved enable row level security;

-- Signed-in students only, and only their own rows.
revoke all on public.bank_saved from anon;
grant select, insert, update on public.bank_saved to authenticated;

drop policy if exists bank_saved_own on public.bank_saved;
create policy bank_saved_own on public.bank_saved
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
