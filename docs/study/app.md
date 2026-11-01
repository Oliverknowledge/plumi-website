# study.tryplumi.app: Desk, Study, Flashcards

First slice of the web app. Three links, in this order: **Desk | Study | Flashcards**.
Everything else (Subjects, Insights, Wardrobe, Search, Settings) is deliberately not here yet.
The Subjects UI is going to change, so nothing was built for it.

## Routes

| URL | What | Source |
|---|---|---|
| `/study` | Desk: greeting, today's scene, to-do, exam countdown, library card, flashcard card | `src/app/study/(app)/page.tsx`, `src/components/studyapp/desk/` |
| `/study/library` | Study: the Grand Library room with real people | `src/components/studyapp/library/`, `docs/study/library.md` |
| `/study/flashcards` | The iPad's two-pane page: subject toggle, My sessions, decks to tick and mix, the wooden desk, Import. See below | `src/components/studyapp/flashcards/` |
| `/study/design`, `/dashboards`, `/shells` | Design system and exploration pages (kept, in the `(system)` route group) | `src/app/study/(system)/` |

Visual source: the founder's artifact (`#desk`), ported to `src/app/study/(app)/app.css`, every selector
under `.pa`, light-only, mapped onto the site's fonts (Pixelify cut, Nunito, Caveat, VT323).

## Hosts, log in and the sign-in gate

One deployment serves two sites, told apart by host in `src/proxy.ts` (decisions and tests in
`src/lib/studyapp/routing.ts`):

| Host | What it serves |
|---|---|
| `tryplumi.app` | The marketing site. Its old `/study`, `/study/library`, `/study/flashcards` redirect to the app's host. |
| `study.tryplumi.app` | The app, at `/`, `/library`, `/flashcards` (rewritten from `/study/...`; the prefix is never shown). Also `/sign-in`, `/sign-up`, `/auth/callback`. Marketing pages redirect to tryplumi.app. `/robots.txt` disallows everything. |
| localhost, previews | Unchanged: the app is under `/study/...`. `study.localhost:<port>` imitates the app host on a laptop. |

- Marketing header: one button, top right, **Get started**, to `study.tryplumi.app/sign-up` (founder, 1 November 2026:
  no separate "Sign in"). A student who is already signed in (the session is shared, below) is passed straight on to the
  Desk, and the website shows their initial with an "Open the app" row in its menu instead. As the bar narrows the
  Discord link, the gaps and the Android icon give way, and on a phone the wordmark does, so Get started always fits.
- The app is behind a sign-in gate (`components/studyapp/AuthGate.tsx`): signed out, it replaces the URL with
  `/sign-in?next=<where you were>` and returns there afterwards. It is a door, not a lock: the session lives in the
  browser, so the check runs there, and anything shared (friends, library, chat) is locked by Supabase row-level
  security, not by this. With accounts off (no Supabase project configured) the gate lets the app open.
- Links inside the app are written as `/study/...` and turned into the host's own form by `AppLink` / `useAppHref`.
- **Invite links** are written on `tryplumi.app` (`/f/<code>`, `/g/<code>`: `inviteUrl`); `plumi.app` is not ours.
  The iPad still writes `plumi.app` links, which go nowhere and need changing in the iPad repo; the web app accepts both
  when reading one. The site does not serve `/f/` or `/g/` yet.

### Before this works in production (not done from code)

1. Supabase, Authentication, URL configuration: add `https://study.tryplumi.app/auth/callback` (and `https://study.tryplumi.app/**`)
   to the redirect allow-list. Without it Google and emailed-link sign-in on the app's host will be refused; codes and
   passwords still work.
2. `study.tryplumi.app` must be attached to this same Vercel project (it is the host the proxy looks for).

### One sign-in for both hosts (`src/lib/sessionStorage.ts`)

The Supabase session is a cookie for `.tryplumi.app`, not localStorage (which is per address, so the website and the app
could not see each other's). Signing in, or out, on either is signing in or out on both. Anywhere else (localhost,
previews) it is an ordinary cookie for that host.

- Everyone already signed in on the website has their localStorage session moved into the cookie the first time it is read:
  nobody is signed out by the change.
- A session is 2 to 3 KB and a cookie holds about 4 KB, so it is stored as base64url chunks (`plumi-auth.0`, `.1`, ...), written
  `Secure; SameSite=Lax; Max-Age=400 days`, and re-written on each token refresh.
- **Costs, stated plainly.** It cannot be `HttpOnly`, because the browser client has to read it, so script on any
  `.tryplumi.app` host can read it (localStorage was one host's script only; ad and analytics tags run on the website).
  The browser also sends it with every request to those hosts; nothing server-side reads it. A tab on the other host is not
  told live when you sign out here; it finds out on its next load. Two hosts can both try to refresh an expiring token at
  once (the browser lock is per host); Supabase's refresh-token reuse window covers it, but it has not been exercised under load.
- Tested: 12 unit tests for the cookie jar behaviour (chunking, stale chunks, migration, domains, size per cookie) and a
  browser test that serves both hostnames from one server: sign in on the website, open the app (already signed in), sign
  out in the app (the website signs out), Get started, "Open the app".

## Lofi record player (`components/studyapp/Vinyl.tsx`, `lib/studyapp/music.ts`)

A record in the bottom-right corner of every page, ported from the founder's personal site. It sits in the app's layout,
so the music carries on between Desk, Study and Flashcards. Lofi only: 12 songs from Lofi Girl's "beats to relax/study to",
in a fresh order every visit (the list is `LOFI` in `music.ts`). They play through Spotify's embedded player, so
students logged in to Spotify in that browser hear whole songs and everyone else hears 30-second previews (they're told
once). It never starts by itself: only a tap on the record. ⏮ / ⏭ skip, songs run on into the next, and the Spotify card
can be tucked away (remembered on the device). Over the full-screen library it gets chalk lines, steps aside for the
drawer, and rises above the seat card on a phone.

## Decisions taken from the founder's answers

1. **Study = the Grand Library room**, not a subject page.
2. **Flashcards and to-dos are saved on this device.** No new Supabase tables. The cost: no sync between
   devices, and clearing site data deletes them. Nothing on screen claims otherwise.
3. **Library = real people in the real room**, sharing the iPad's backend. See `library.md`.

## Data (device only)

One versioned JSON document in `localStorage["plumi-study-app"]`, read through a `useSyncExternalStore`
store (`src/lib/studyapp/store.ts`), sanitised on load, kept in step across tabs by the `storage` event.
"Today" is the London calendar day everywhere (`time.ts`).

## Spaced repetition (`srs.ts`, deterministic, `now` injected)

SM-2 family. Learning steps 1 min and 10 min, graduating interval 1 day, Easy 4 days, starting ease 2.5
(floor 1.3), Hard ×1.2, Good ×ease, Easy ×ease×1.3. A lapse goes to relearning at 10 min, then restarts at
half the previous interval. New cards are capped at 10 per day (per-deck setting). The four grade buttons
show the real next interval. A flipped card is pinned: time passing never swaps it for another.

## Flashcards page (laid out like the iPad's)

Left column (330px; above the desk on a phone): the subject toggle (All subjects, plus a segment per subject the student has
decks in), MY SESSIONS, the decks with a tick box each ("Tick to mix", due count, a quiet stat line), then the dashed
buttons: Import, + New deck, From my notes, From my mistakes. Right: a wooden desk (CSS only) with "+ Card", a pill
(what is being reviewed, "N due" or "Done"), a fill-the-screen button (Escape leaves), the card, the four grades BELOW the
card (with the real interval under each), and four colour counters for this session. The grades are never inside the card.

- **What is on the desk:** decks ticked in the list (a mix) win; else the deck or session that was clicked; else everything due
  in the chosen subject. Clicking a deck's name reviews it; its "..." button opens the editor (add, edit, delete, import into it,
  copy out, rename, delete) in the desk's place. Counters reset whenever that changes.
- **Sessions** (`AppData.sessions`: `{id, name, deckIds[]}`, device only): "+ New session" turns the ticked decks into a named
  mix (name trimmed, at most 40 characters). Rename or delete from the pencil. Deleting a deck removes it from every session, and
  a session left with no decks goes too. The document is still `v: 1`: the field is additive, a save without it reads as no
  sessions, and a tab on the older site ignores it instead of discarding the save.
- **Import** (`src/lib/studyapp/ankiImport.ts`): a file (.txt, .csv, .tsv) or pasted text. Reads Anki's "Notes in Plain Text"
  (`#separator`, `#html`, and the guid, notetype, deck and tags columns are skipped), detects a separator when none is
  declared, handles quoted fields, turns `<br>` and block tags into line breaks and `<sup>`/`<sub>` into superscript and
  subscript characters, strips every other tag, decodes entities once, makes cloze notes into a question and answer, and
  drops invisible direction-changing characters. Output is plain text and cards are only ever rendered as text. Limits: 1 MB,
  5000 cards, cards cut to 400 and 800 characters (the preview says how many). `.apkg` packages are refused with how to export
  plain text from Anki.
- **From my notes / From my mistakes** need the iPad's notebook and marking. They are shown disabled with an "On iPad" hint,
  not faked.

## Starter decks

Four decks of ten cards (`starterDecks.ts`): Chemistry Carbonyls, Physics Mechanics, Maths Differentiation,
Biology Cells and transport. They carry "Reviewed by: nobody yet". **They have not been checked by a teacher.**
Do not market them as exam-accurate until someone qualified has gone through them.

## Verification (run on this branch)

- `npm run app:test`: SRS, model, host routing, invite and session-cookie tests (69 at the time of writing).
- Playwright against a dev server, fake clock: Desk script (28 checks) and Flashcards scripts (see the branch report):
  greeting, three-link nav, tasks, exam countdown, starter deck, flip and grade by keyboard, 10-card cap,
  learning steps and return after 11 minutes, import and export, persistence across reload, no horizontal
  overflow at 1280 and 390, no console errors.
- Colour contrast measured with `scripts/study-contrast.ts` method (WCAG).

## Known gaps (honest list)

- **Contrast.** The artifact's `--mute` (#8f9cb6) was 2.6:1 on paper, its placeholder 1.8:1 and its done-task
  text 2.9:1. `--mute` is now #5f6d8c (4.8:1 on paper, 5.1:1 on cards) and placeholder and done text use it.
  The look is slightly less airy than the artifact. This is a deliberate departure.
- No cross-device sync, no account-backed data. Signed-in state only drives the Account menu and the Library.
- The Desk scene is a static crop (day until 18:00, evening 18:00 to 05:00 London), not animated.
- No analytics are collected by these pages.
- Not yet verified on a real iPad browser or Safari. Chromium only.
- Undecided for the founder: App Review 1.2 moderation contact for user-generated chat.
