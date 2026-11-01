# Multiplayer on the web: the Supabase side

Friends, study groups, the study hall, presence and group chat on **study.tryplumi.app**, on the same
Supabase project and the same accounts as the iPad app.

## The short version

The multiplayer backend **already exists and is shared**. It is the app repo's migrations `0104` to
`0123` (`Supabase/migrations/`): tables, row-level security, 56 public functions a signed-in student may call (none open to signed-out visitors),
Realtime channel policies, and a chat filter. The website already uses it (`src/lib/library.ts`, "Join the
library", calls `social_opt_in` on it).

So this work added **no migration and no tables**. A second copy of the schema in this repo would be a
fork of a contract the iPad also speaks, and the first time the two drifted a student would see it.
What the website lacked was the *client side* of that contract and a way to *prove* the project is ready.
That is what is here.

| | Where | What it is |
|---|---|---|
| Web client | `src/lib/social/` | Typed friends, groups, presence, hall, reactions and chat calls, as the iPad's `SocialService`, plus the hall's realtime. |
| Chat rules | `src/lib/social/chatRules.ts` | The browser's copy of the server's chat filter, so a student is told before sending. |
| Readiness check | `supabase/checks/social_applied.sql` | One read-only query to paste into the SQL editor: which migrations the project has, which functions and tables, whether signed-out visitors are locked out. |
| Tests | `social.test.ts`, `scripts/social-e2e.ts` | 54 unit tests; 26 end-to-end checks against the real schema. |

## What each side owns

| Concern | Owner | Notes |
|---|---|---|
| Who may see whom, rate limits, the word list, moderation | **The database** (`can_see`, RLS, `chat_refusal`) | The one authority. The web never decides these. |
| A mistyped code, a message the chat will refuse | Browser, first | Cheap and kind; the server's answer is still the one that counts. |
| Failures | `Result`, never thrown | A student never sees an error: every failure is a value the screen turns into a quiet state. Same rule and same lines as the iPad (`failure.ts`). |
| Realtime | Supabase, private channels | `walk:<hall>:<user>` and `chat:<group>`; who may join is `0113`'s policies. An enhancement: everything works a few seconds behind without it. |

## Is the project ready? (do this first)

Paste `supabase/checks/social_applied.sql` into the Supabase SQL editor and Run. It changes nothing.
Every row says `ok` or `MISSING`:

- **migration**: which of 0104, 0105, 0107 to 0110, 0112, 0113, 0118 the project has.
- **rpc**: each of the 28 functions the web calls, with exactly the argument names the web sends, callable
  when signed in and **not** by a signed-out visitor.
- **table**: each of the 8 tables the web reads has row-level security on, and a signed-out visitor cannot read it.
- **columns**: how far up the column ladder the server is (the web reads the newest columns it can, then older sets, like the iPad).
- **realtime**: the private-channel policies.

Anything MISSING under *migration* is a file to run, in number order, from the app repo's
`Supabase/migrations`. Then in the dashboard, **Realtime, Settings, turn off "Allow public access"** (a
dashboard setting, so the SQL cannot see it), so a channel can only be joined through the policies.

## Commands

```bash
npm run social:test       # 54 unit tests, no network, no database
npm run social:verify     # the tests, plus: generated files match their sources
npm run social:vectors    # regenerate chat.vectors.json from the app repo's chat_test.sql
npm run social:check-sql  # regenerate the readiness SQL from src/lib/social/api.ts
```

Against a database (a scratch one: these write test users, and the end-to-end refuses anything not on this machine):

```bash
PGHOST=localhost PGPORT=5544 PGUSER=postgres PGDATABASE=postgres npm run social:contract   # the readiness check
PGHOST=localhost PGPORT=5544 PGUSER=postgres PGDATABASE=postgres npm run social:e2e        # three students, end to end
```

The app repo's `tools/social-check/run.sh` builds such a database in Docker (`SOCIAL_CHECK_KEEP=1` leaves it running).

## What was verified, and how

Paid model calls: **none**. Everything below ran against a local Postgres 16 holding the app's real
migrations.

| Claim | Evidence |
|---|---|
| The schema works as the iPad's own tests say | The app's SQL suites, run here: social 224, hall 48, cafe 7, person 8, **chat 129**, positions 21, realtime 56, join requests 42, streaks 8, lobby 83 (all passing at the harness's own migration set), each migration applied twice to prove it re-applies cleanly. |
| The browser's chat filter matches the server's | 72 vectors from `chat_test.sql`, plus **21,020 adversarial messages** (evasions, lookalikes, fullwidth, zero-width, links, phone numbers, innocent words, odd Unicode) through both the web code and the real `chat_refusal`: **0 disagreements**. The first run found 7, all one cause (see below). |
| The service uses the right tables, columns, functions and argument names | The end-to-end run: three students, the real schema, row-level security on, 26 checks. |
| The readiness check can fail | It reports 54 of 54 on the full schema, and exactly the six expected gaps on a deliberately old one (up to 0110). It also flags a function wrongly opened to signed-out visitors and a table wrongly readable by them (both injected on purpose, then reverted). |
| Signed-out visitors cannot call or read any of it | Every one of the 56 public functions (including the 28 the web calls) and the 8 tables the web reads: none reachable by `anon`, all tables with row-level security. |

### Defects the verification found in the web code (fixed)

1. **Friend requests to a bad code would have said "sent".** `send_friend_request` answers with a word
   (`not_found`, `blocked`, `self`, `already_friends`, `pending`, `accepted`), it does not raise. My first
   version turned everything except `accepted` into "pending". Found by the end-to-end run, not by my unit tests.
2. **The chat filter treated non-Latin letters as word breaks.** JavaScript's `\b` counts only ASCII letters;
   the server's regex counts every Unicode letter, so "世界dot com" is a link here and not there. Found by the fuzz.
3. A read that names a column an older server lacks would have blanked the whole screen. It now climbs down a
   column ladder, as the iPad does.

### Behaviour worth knowing (the server being right, and my assumptions being wrong)

- After a friend request, the sender **cannot see the recipient's name** until it is accepted; the recipient
  sees who asked. A student who types a code learns nothing about whose it is.
- A student outside a group asking for its hall is **refused** (`not_member`), not shown an empty hall.
- A reaction to the same person twice within ten minutes answers `too_soon`; that is an outcome, not an error.

## Found in the app repo (not changed: it is not this branch's to change)

- `tools/social-check/lobby_test.sql` fails five assertions (73 to 76 and 80, "a full shard...") once `0121` is
  applied, because 0121 raised the shard cap from 40 to 60. The test still assumes 40. The server is as intended.
- `tools/social-check/run.sh` applies migrations only up to `0120`; **0121, 0122 and 0123 are not in the harness**.
- `library_chat_test.sql` line 122 reads `lobby_profile` as the student; that table is deliberately revoked from
  students (0117), so the query is refused. A test-side slip: the refusal is the protection working. I did not
  re-run it past that line.

## Not built, and not verified

- **No screens.** `/study/dashboards/squad` and the shells are layouts with sample data; nothing renders this
  library yet. The next step is wiring the Multiplayer places to `social` (`src/lib/social/browser.ts`).
- **Realtime is tested against a fake channel, not a real Realtime server.** The topics, the private flag, the
  presence key and the payloads follow the app's code and 0113's policies; whether Supabase accepts them as
  written is unproven until a student joins a real hall.
- **PostgREST is not in the loop.** The end-to-end transport reproduces what PostgREST does in SQL, so URL
  routing, JSON argument casting and CORS are untested. `supabase-js` is what the site already uses for
  `social_opt_in`, which is evidence for the calling convention, not for every function.
- **The lobby, the Grand Library floor and its chat** (0117 to 0123) have server functions and are listed in
  the app's client, but have no web client yet. Library chat has its own spam filter (`library_spam`, 0120) that
  would need the same mirror and the same fuzz.
- **Invite links.** The iPad writes `https://plumi.app/f/<code>` and `/g/<code>`. Nothing serves those paths
  on the web (and `plumi.app` is not this site's domain). `parseInvite` reads them; a landing route, and the
  decision about which domain they live on, are open.
- **A live project.** I could not reach one. Whether 0104 to 0123 are applied there is unknown until the
  readiness check is run. The website already calls `social_opt_in`, so 0104 at least is.

## Safety (students are 13 to 18)

The web inherits everything the server enforces and must not weaken any of it: nothing is shared until a
student opts in ("Join the library"); no free text exists beyond a filtered name and the filtered chat; a
stranger is only ever a made-up nickname; two reports hide a message. The App Review guideline 1.2 items the
app's `group-chat.md` still lists as open (a named moderator, a published contact address, a response time)
apply to a chat on the web as much as on iPad.
