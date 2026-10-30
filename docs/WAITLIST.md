# Turning the waitlist on

The form is built and the API route is live. It writes to Supabase, and until
Supabase is configured **it refuses signups and tells the student so**. It does
not queue them, it does not email them to anyone, and it does not pretend.

There are four steps and they take about ten minutes.

---

## What happens if you skip this

Nothing is silently dropped. With no backend configured:

- `POST /api/waitlist` returns **503** with `{"ok": false, "code": "unconfigured"}`.
- The form shows: *"We can't take sign-ups right this second. Try again shortly
  — we haven't lost anything you typed."*
- The email stays in the field so a retry is one tap.
- The server logs `[plumi] Waitlist signup rejected: no backend configured.`
- **No success state is ever shown.** A student is never told they are on a list
  they are not on.

That is the deliberate failure mode. The alternative — a green tick over a
dropped address — is only discovered on launch day, when the emails do not
arrive.

---

## 1. Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**.
2. Region: somewhere in the EU (the analytics is already on PostHog EU, and the
   students are in the UK).
3. Save the database password somewhere real. You will not need it for this,
   but you will need it eventually.

## 2. Run the migration

`supabase/migrations/0001_waitlist.sql` in this repo is the whole schema.

Either paste it into **SQL Editor → New query → Run**, or, with the Supabase
CLI linked to the project:

```bash
supabase db push
```

It creates the `citext` extension, the `waitlist_signups` table, two indexes,
and enables row-level security **with no policies** — see step 4 for why that
is the point rather than a mistake.

## 3. Set two environment variables in Vercel

**Project → Settings → Environment Variables.** Add both to Production,
Preview and Development:

| Name | Where to find it | Example |
|---|---|---|
| `SUPABASE_URL` | Project Settings → Data API → Project URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role` (click to reveal) | a long JWT starting `eyJ…` |

Optional: `SUPABASE_WAITLIST_TABLE` if you ever rename the table. It defaults to
`waitlist_signups`.

Then **redeploy**. Environment variables are read at request time by the route
handler, but Vercel only applies new variables to new deployments.

### Why the service role key must never be `NEXT_PUBLIC_`

Anything prefixed `NEXT_PUBLIC_` is **inlined into the JavaScript bundle that
every visitor downloads**. It is not a secret, it is a publication.

The `service_role` key bypasses row-level security completely — it is the
database owner in one string. Published, it would let anyone dump the full list
of email addresses, and edit or delete anything else in the project.

So:

- Name it exactly `SUPABASE_SERVICE_ROLE_KEY`. No prefix.
- It is only ever read in `src/lib/waitlist/store.ts`, which begins with
  `import "server-only"` — a build error if that file is ever pulled into a
  client component.
- If it does leak: Supabase dashboard → **API Keys → Rotate**, then update
  Vercel and redeploy. Assume the list was read.

The anon key is not used by this site at all and does not need to be set.

## 4. Check it

**The 30-second version:**

```bash
curl -i -X POST https://tryplumi.app/api/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"email":"you+test@yourdomain.com","subject":"Physics","board":"OCR"}'
```

- `200 {"ok":true,"code":"created"}` → working. The row is in **Table Editor →
  waitlist_signups**, with `subject = Physics` and `board = OCR`.
- `503 … "unconfigured"` → the variables are missing, or you have not redeployed.
- `502 … "server_error"` → Supabase was reached and refused. Check the Vercel
  function logs; the reason is logged in full. Usually the migration has not been
  run.
- `429` → the rate limiter, five attempts a minute per IP. Wait a minute.

**Then use the real form**, on a phone, at <https://tryplumi.app/#waitlist>.
Submit a bad address and check you get *"That doesn't look like an email
address"*. Submit a good one and check you get the sleeping bird — and then
check the row exists. The bird is the only success state; if you see it, a row
was written.

**Check the lock while you are there.** Signups are readable in the Supabase
dashboard (that session uses the service role). They are not readable with the
anon key — which is what RLS-on-with-no-policies buys, and what you would be
undoing if you ever added a policy to this table to "make it work" from the
browser.

---

## What gets stored

One row per email address, ever (`email` is `citext not null unique`, so a
second signup with the same address is a no-op the student never sees).

- `email`
- `subject`, `board` — only if they chose them; both are optional in the form,
  and the route drops anything that is not one of the exact options the form
  offers. Arbitrary strings from a POST body never reach the table.
- `utm_*`, `landing_variant`, `referrer_host`, `gclid`, `fbclid`, `ttclid` — the
  query string their own click carried.
- `user_agent`, `country` — coarse country from the edge only.
- `created_at`.

**No IP address is stored.** It is used to rate-limit the request and then
discarded. **No email address is ever sent to PostHog** — `waitlist_completed`
carries a `has_course` boolean and nothing else.

---

## Exporting the list

Table Editor → `waitlist_signups` → **Export → CSV**. Or, for the question this
table exists to answer — which course to hand-build next:

```sql
select subject, board, count(*)
from public.waitlist_signups
group by subject, board
order by count(*) desc;
```

## Removing someone

Students are told they can leave by replying to any email. Do it by hand:

```sql
delete from public.waitlist_signups where email = 'them@example.com';
```

---

## Without a secret key (30 October 2026)

`supabase/migrations/0002_join_waitlist.sql` adds one function, `join_waitlist`, that the project's **public**
key may call. It adds one row to `waitlist_signups` and returns whether the email was new; it cannot read the
table, change a row or delete one (RLS is still on with no policies; checked with the public key: a read returns
`[]` and a direct insert is refused). The site uses it whenever there is no service role key, so the host needs only:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | The project's public (publishable) key |

Both are set in Vercel (Production) for the `plumi` Supabase project. Rows from the Android page have
`source = 'android'`: `select count(*) from waitlist_signups where source = 'android'`.

## The Android welcome email

`/android` signups get one email (`src/lib/waitlist/androidWelcomeEmail.ts`: Plumi's notebook look and a
"Join the Plumi Discord" key), sent after the response, only when the email is new. It needs a Resend account:

1. resend.com, add the domain `tryplumi.app` and put the DNS records it gives you in the domain's DNS.
2. Create an API key and add it in Vercel (Production) as `RESEND_API_KEY`.
3. Redeploy. `WAITLIST_EMAIL_FROM` is optional and defaults to `Plumi <hello@tryplumi.app>`.

Until `RESEND_API_KEY` is set the signup still works and the server logs that no email was sent.

## Sending to the whole list (Resend audience)

The Android list is mirrored into the Resend audience **Plumi Android waitlist** (id `5efffb52-ed23-4dc9-8fe1-fc47ef3642f8`), so
a **Broadcast** from resend.com/broadcasts reaches everyone who joined. Supabase stays the list; the audience is a copy for sending.

- A broadcast needs `{{{RESEND_UNSUBSCRIBE_URL}}}` in it: Resend's own unsubscribe, which marks the contact unsubscribed there.
  The welcome email's Unsubscribe link instead deletes the person from Supabase and, with the two variables below, from the audience.
- Automatic sync on signup and unsubscribe needs `RESEND_AUDIENCE_ID` and `RESEND_CONTACTS_KEY` (a Resend key with full access;
  a sending-only key is refused by the contacts API) in Vercel. Without them the site works and the audience is synced by hand:
  `select email from waitlist_signups where source = 'android'` and add the new ones to the audience.
