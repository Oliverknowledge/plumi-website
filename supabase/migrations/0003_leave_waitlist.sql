-- ═══════════════════════════════════════════════════════════════════════════
-- Plumi website: leave the waitlist, from the link in the email
--
-- A student who joined can take themselves off with the link in the welcome email. The link carries an HMAC of
-- their email made with a secret that only the website and this database know, so nobody can remove somebody
-- else. The secret lives in `waitlist_secret` (RLS on, no policies, so no key but the service role can read it) and
-- is set once by the person who runs this migration: `insert into public.waitlist_secret (id, secret) values (1, '...')`.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.waitlist_secret (
  id     integer primary key check (id = 1),
  secret text not null
);
alter table public.waitlist_secret enable row level security;

create or replace function public.leave_waitlist(p_email text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text;
  removed integer;
begin
  select secret into key from public.waitlist_secret where id = 1;
  if key is null or p_email is null or p_token is null then
    return false;
  end if;
  if encode(extensions.hmac(lower(p_email), key, 'sha256'), 'hex') <> lower(p_token) then
    return false;
  end if;
  delete from public.waitlist_signups where email = lower(p_email);
  get diagnostics removed = row_count;
  return true;
end;
$$;

revoke all on function public.leave_waitlist(text, text) from public;
grant execute on function public.leave_waitlist(text, text) to anon, authenticated;
