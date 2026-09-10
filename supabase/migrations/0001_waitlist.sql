-- ═══════════════════════════════════════════════════════════════════════════
-- Plumi website — waitlist
--
-- One table. It holds the least we can hold and still run a launch: an email
-- address, the course the student volunteered, and where the click came from.
--
-- Everything the website sends is written by the Next.js route handler
-- (src/app/api/waitlist/route.ts) using the Supabase *service role* key, which
-- bypasses RLS. So this table has RLS enabled and NO policies at all — see the
-- block at the bottom, which is the security model rather than a formality.
--
-- Run it once, in the Supabase SQL editor or via `supabase db push`.
-- Setup instructions: docs/WAITLIST.md
-- ═══════════════════════════════════════════════════════════════════════════

-- Case-insensitive text, so Sam@school.ac.uk and sam@school.ac.uk are the same
-- person and the unique constraint below actually means something. The route
-- also lower-cases on the way in; this is the belt to that pair of braces.
create extension if not exists citext;

create table if not exists public.waitlist_signups (
  id              uuid primary key default gen_random_uuid(),

  email           citext not null unique,

  -- Acquisition. Not personal data: this is the query string the student's own
  -- click already carried, plus the host of the page that sent them. The IP is
  -- deliberately absent — it is used transiently for rate limiting and never
  -- stored.
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  landing_variant text,
  referrer_host   text,
  gclid           text,
  fbclid          text,
  ttclid          text,

  user_agent      text,
  -- Two-letter country from the edge (x-vercel-ip-country / cf-ipcountry).
  country         text,

  -- What they told us they study. Allow-listed by the route against the pills
  -- the form offers, so these are a closed vocabulary and worth grouping by:
  -- the release order of the hand-built topic trees is decided from them.
  subject         text,
  board           text,

  -- Where the row came from, in case a second surface ever writes here.
  source          text not null default 'website',

  created_at      timestamptz not null default now()
);

-- The two questions actually asked of this table: "how many, this week?" and
-- "which course should we finish next?".
create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at desc);

create index if not exists waitlist_signups_course_idx
  on public.waitlist_signups (subject, board);

-- ── Access ─────────────────────────────────────────────────────────────────
--
-- RLS is ON and there are NO policies. In Postgres that means: every request
-- authenticated as `anon` or `authenticated` can read nothing and write
-- nothing. That is the intent, not an oversight.
--
-- Inserts come from the server only, over PostgREST, with
-- SUPABASE_SERVICE_ROLE_KEY. The service role bypasses RLS entirely, so it is
-- unaffected by the absence of policies.
--
-- The consequence worth having: the anon key is public by design — it ships in
-- any browser bundle that uses it — and if it leaks, or is simply read out of
-- the page source, it still cannot read a single email address from this table.
-- Adding a policy here to "make it work" from the browser would undo that; if
-- the form ever appears to need one, the fix is to keep the insert on the
-- server.
--
-- Read the list yourself in the Supabase dashboard: that session uses the
-- service role and is likewise unaffected.
alter table public.waitlist_signups enable row level security;

comment on table public.waitlist_signups is
  'Pre-launch waitlist. Written server-side with the service role key; RLS on with no policies, so a leaked anon key cannot read it.';

comment on column public.waitlist_signups.subject is
  'Allow-listed against waitlist.subjects in src/content/copy.ts. Never free text from a POST body.';

comment on column public.waitlist_signups.board is
  'Allow-listed against waitlist.boards in src/content/copy.ts. Never free text from a POST body.';
