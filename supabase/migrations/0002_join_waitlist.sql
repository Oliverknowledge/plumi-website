-- ═══════════════════════════════════════════════════════════════════════════
-- Plumi website: join the waitlist without a secret key
--
-- The website used to need the project's SERVICE ROLE key in its host's environment,
-- which on a shared project is a key to everything. This function is the one door the
-- public key gets instead: it can add one row to `waitlist_signups` and nothing else.
-- It cannot read the table (RLS stays on with no policies), update a row or delete one.
--
-- Returns true when the email was added and false when it was already on the list, so
-- the website can send its welcome email once. The website never shows a student that
-- difference.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.join_waitlist(
  p_email           text,
  p_source          text default 'website',
  p_subject         text default null,
  p_board           text default null,
  p_utm_source      text default null,
  p_utm_medium      text default null,
  p_utm_campaign    text default null,
  p_utm_content     text default null,
  p_utm_term        text default null,
  p_landing_variant text default null,
  p_referrer_host   text default null,
  p_gclid           text default null,
  p_fbclid          text default null,
  p_ttclid          text default null,
  p_user_agent      text default null,
  p_country         text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  if p_email is null or length(p_email) > 254 or p_email !~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$' then
    raise exception 'waitlist:bad_email';
  end if;
  if p_source is null or p_source not in ('website', 'android') then
    raise exception 'waitlist:bad_source';
  end if;

  insert into public.waitlist_signups (
    email, source, subject, board,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_variant, referrer_host, gclid, fbclid, ttclid, user_agent, country
  ) values (
    lower(p_email), p_source, left(p_subject, 60), left(p_board, 60),
    left(p_utm_source, 200), left(p_utm_medium, 200), left(p_utm_campaign, 200),
    left(p_utm_content, 200), left(p_utm_term, 200),
    left(p_landing_variant, 200), left(p_referrer_host, 200),
    left(p_gclid, 200), left(p_fbclid, 200), left(p_ttclid, 200),
    left(p_user_agent, 400), left(p_country, 8)
  )
  on conflict (email) do nothing;

  get diagnostics added = row_count;
  return added > 0;
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

comment on function public.join_waitlist is
  'The public key''s only way onto the waitlist: adds one row, returns whether it was new. Reads nothing.';
