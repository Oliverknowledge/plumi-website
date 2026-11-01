# study.tryplumi.app: Desk, Study, Flashcards

First slice of the web app. Three links, in this order: **Desk | Study | Flashcards**.
Everything else (Subjects, Insights, Wardrobe, Search, Settings) is deliberately not here yet.
The Subjects UI is going to change, so nothing was built for it.

## Routes

| URL | What | Source |
|---|---|---|
| `/study` | Desk: greeting, today's scene, to-do, exam countdown, library card, flashcard card | `src/app/study/(app)/page.tsx`, `src/components/studyapp/desk/` |
| `/study/library` | Study: the Grand Library room with real people | `src/components/studyapp/library/`, `docs/study/library.md` |
| `/study/flashcards` | Review, Decks, deck editor, starter decks | `src/components/studyapp/flashcards/` |
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

- Marketing header: **Log in** goes to `study.tryplumi.app` (signed in: the Desk; signed out: its sign-in page);
  **Get started** goes to its `/sign-up`. A signed-in student sees an avatar with "Open the app". On a phone the bar
  keeps "Log in" only.
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
3. **Two sessions, not one.** A browser keeps its session per address, so signing in on `study.tryplumi.app` does not
   sign you in on `tryplumi.app` and the other way round. The question bank's "keep your marks on every device" still
   signs in on `tryplumi.app`. One session across both would need the Supabase session stored in a cookie shared on
   `.tryplumi.app`; that is a separate, security-sensitive change and was not made.

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

## Starter decks

Four decks of ten cards (`starterDecks.ts`): Chemistry Carbonyls, Physics Mechanics, Maths Differentiation,
Biology Cells and transport. They carry "Reviewed by: nobody yet". **They have not been checked by a teacher.**
Do not market them as exam-accurate until someone qualified has gone through them.

## Verification (run on this branch)

- `npm run app:test`: SRS, model, host routing and invite tests (57 at the time of writing).
- Playwright against a dev server, fake clock: Desk script (28 checks) and Flashcards script (25 checks):
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
