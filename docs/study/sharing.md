# Sharing a flashcard deck by link

A student taps **Share** on a deck they made, gets `https://study.tryplumi.app/d/<code>`, and a friend opens it in any browser
with no sign-in, flips through the cards, and taps **Add to my decks** to put a private copy in their own web flashcards. Free
for everyone: there is no Pro check anywhere. (Founder decision, 5 November 2026: sharing happens on the web, not in the iPad app.)

## How it works

```
Flashcards page (signed in)           Supabase (migration 0130, iPad repo)         /d/<code> (public)
  Share > Make a link  ── share_deck ──────────────▶ shared_deck row ◀── get_shared_deck ── server render
  Stop sharing         ── unshare_deck ────────────▶ taken down                              (anon key, no sign-in)
  Shared tag / list    ── my_shared_decks ─────────▶ the caller's live decks
                                                      report_shared_deck ◀── Report this deck (anon key)
```

Everything is text: `{front, back}` strings. A deck leaves the device only when the student taps **Make a link**; the card
schedule, ease and review history never do.

### Code

| Where | What |
|---|---|
| `src/lib/studyapp/sharing/contract.ts` | The five RPC names and their parameters, the limits, the error words, the code shape, the kill switch. Held against the migration by `npm run sharing:contract`. |
| `.../sharing/payload.ts` | `canShare(deck)` and `sharePayload` (text only, trimmed, empty cards dropped, caps: 500 cards, 1,500 characters a side, 2,000,000 bytes). |
| `.../sharing/service.ts` | `createSharing(api)`: share, unshare, mine, get, report over the existing `Api` transport. Returns values, never throws at a view. |
| `.../sharing/rest.ts` | The same calls over plain `fetch` with the public key: used by the public page (server side to read, browser side to report) so it does not load the Supabase client. |
| `.../sharing/lines.ts` | Every error word as one calm line. No em dashes, no jargon, never "error". |
| `.../sharing/probe.ts` | Is sharing on in this project? Asked once per visit and remembered for the tab. |
| `.../sharing/add.ts` | `addSharedDeck` (a normal private deck, new ids, fresh schedule) and the codes remembered on this device. |
| `.../sharing/client.ts` | The flashcards page's hook: availability, live decks, share, stop. |
| `src/components/studyapp/flashcards/ShareSheet.tsx` | The Share sheet and "Your shared decks". The Share button is in the deck editor; the Shared tag is on the deck row. |
| `src/app/d/` and `src/components/studyapp/share/` | The public page: layout, server-rendered page, viewer, report sheet, the not-shared state. |
| `src/lib/studyapp/routing.ts` | `/d/<code>` passes on the app host with no sign-in step; on tryplumi.app it redirects to the app's host. |

### Which decks may be shared (`canShare`)

A deck the student **made** (typed or pasted) or **imported** (Anki, CSV). Not Plumi's ready-made starter decks (`deck.starter` is
set). The web has no deck made from exam-board mark schemes, past papers or mistakes (those buttons are "On iPad" and disabled);
a test lists a deck's fields so that a new kind of deck forces a decision in `canShare`.

### The public page

* Server rendered, `export const dynamic = "force-dynamic"`, `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`
  (next.config.ts), `robots: noindex, nofollow` in the HTML and `X-Robots-Tag`. The cards are in the HTML; a `<noscript>` list shows
  them all without script.
* No site furniture: `SiteOnly` leaves out structured data, the ad tag, the consent banner and the site's analytics on `/d/`, so
  nothing records which deck was opened. The page requests nothing from any other site (checked in the browser).
* One card at a time; tap, click, Space or Enter turns it (a quick narrowing turn, a cross-fade under reduced motion); Back and Next
  or the arrow keys move; dots for up to 24 cards, a pixel bar above that, and the count in words.
* **Add to my decks** needs no sign-in: it writes to this browser's flashcards (localStorage of the page's own host) and remembers
  the code in `plumi-shared-added`, so the same link says "Already in your decks" until the copy is deleted. "Open my decks" goes to
  the app's flashcards page, which has its usual sign-in door.
* **Report this deck**: three reasons, `report_shared_deck`, one confirmation line.
* A busy minute (`rate_limited`: the database throttles per caller, and every server render comes from the site's own address) shows
  "Lots of people are looking right now. Try again in a minute." with Try again, never the not-shared wording.
* A found deck is kept 20 seconds per server instance and code (`loader.ts`) to spare the database, so a stopped link can still open for
  up to 20 seconds. Refusals are never kept. The HTTP response itself stays `no-store`.
* A deck that is unknown, stopped, hidden, or a project that has not had the migration: "This deck is not shared any
  more." with a button to the app. A connection that fails shows "This deck is taking a nap." with Try again.

### Until the migration is applied

`probe.ts` asks once per visit (`my_shared_decks` for a signed-in student, `get_shared_deck` with a made-up code otherwise). A
PostgREST 404 / `PGRST202` / "could not find the function", or no Supabase configured, means **off**: no Share button, no Shared tag,
no list, and every `/d/` link shows the not-shared page. A failed connection is **unknown**: Share stays hidden and it asks again
next time.

## The contract (summary; the file wins)

`/home/user/sharedecks-ipad/tools/shared-decks-check/CONTRACT.json` (iPad repo, migration `0130_sharedDecks.sql`).

| RPC | Parameters | Returns | Who |
|---|---|---|---|
| `share_deck` | `p_title`, `p_cards` (array of `{front, back}`), `p_subject_hint` | the code (16 characters of `0123456789abcdefghjkmnpqrstvwxyz`) | signed-in, not anonymous |
| `unshare_deck` | `p_code` | boolean | signed-in |
| `my_shared_decks` | none | rows `{code, title, card_count, created_at}` | signed-in |
| `get_shared_deck` | `p_code` | `{title, subject_hint, card_count, cards}` | anyone (anon key) |
| `report_shared_deck` | `p_code`, `p_reason` | void | anyone (anon key) |

Errors arrive as the exception message `social:<code>` (P0001, HTTP 400): `not_signed_in`, `bad_request`, `empty_deck`,
`too_many_cards`, `card_too_long`, `title_too_long`, `too_many_decks`, `too_many_today`, `not_found`, `rate_limited`. A `42501`
(the plain anon role calling a signed-in function) is read as "sign in". A JSON `null` from `get_shared_deck` is `not_found`. Limits: 500 cards,
1 to 1,500 characters a side, title 80, subject hint 40, 20 live decks, 10 shares per 24 hours, 2,000,000 bytes of cards.

`npm run sharing:contract` fails when a function, a parameter, a limit, an error word or the code shape here differs from that file
(`SHARED_DECKS_CONTRACT` overrides the folder; absent file: prints SKIPPED).

## How to turn it off

* **Kill switch:** set `NEXT_PUBLIC_SHARED_DECKS=off` in Vercel and redeploy. No Share, no tag, no list, and every link shows the
  not-shared page without asking the database. Nothing is deleted; remove the variable and it all comes back.
* **Or, at the database,** stop sharing is per deck by the student; the migration's own switches (hide, take down) are in its CONTRACT.md.
* Removing the feature from the code: delete `src/app/d/`, `src/components/studyapp/share/`, `ShareSheet.tsx`, the three small edits
  in `DeckEditor.tsx`, `SidePanel.tsx` and `FlashcardsPage.tsx`, the `/d/` lines in `routing.ts`, `SiteOnly.tsx` and `next.config.ts`.

## Tests

* `npm run sharing:test`: 69 unit tests (also part of `npm run app:test`).
* `npm run sharing:contract`: the contract check.
* Browser checks against a fake Supabase (`/tmp/.../scratchpad/shares/{stub,pub,app}.js`, not in the repo): see the handoff.
