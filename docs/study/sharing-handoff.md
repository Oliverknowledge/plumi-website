# Sharing a deck by link: handoff (website half)

Branch `feature/shared-decks` (website repo). Not merged, not deployed. See `sharing.md` for how it works.

## What was built

1. **Data layer** `src/lib/studyapp/sharing/`: code validation and links, `canShare`, payload shaping, calm error lines, a service
   over the existing `Api` transport (share, unshare, mine, get, report), a fetch binding for the public page, the availability probe,
   `addSharedDeck`, remembered codes, a kill switch (`NEXT_PUBLIC_SHARED_DECKS=off`).
2. **Share UI** in web flashcards: Share button in the deck editor (decks made or imported only), a sheet (Make a link, link pill,
   Copy, Send via `navigator.share` where it exists, one line "N cards. Anyone with the link can read it.", Stop sharing), a "Shared"
   tag on the deck row, "Shared decks (N)" list from `my_shared_decks`. Anonymous session: "Sign in to share" with a sign-in button.
3. **Public page** `/d/<code>`: server rendered, no sign-in, no app shell, light only, noindex, no analytics or other-site requests,
   flip viewer, Add to my decks, Report, not-shared and "taking a nap" states.
4. **Privacy policy** (`src/content/legal.ts`, dated 5 November 2026): what is stored, who can read it, how long, reports, deletion.
5. **Tests**: 69 unit tests (`npm run sharing:test`, also in `app:test`), `npm run sharing:contract`, 163 + 91 browser checks.
6. **Docs**: `sharing.md`, this file.

## App Store Connect, App Privacy (for the founder; nothing was changed there)

Sharing stores user-written text on our servers. If the App Privacy answers are meant to cover this:
**User Content > Other User Content: collected, linked to the user (stored against their account), not used for tracking.**
Purpose: App Functionality. It applies once the migration is applied and the feature is live. The iPad app itself does not call
these functions, so whether the App Store answer must change is the founder's call; I changed no App Store answers.

## Deploy order

1. Apply migration `0130_sharedDecks.sql` (iPad repo, branch `feature/shared-decks`) to the Supabase project.
2. Run `npm run sharing:contract` (and the iPad repo's own SQL checks).
3. Merge the website branch and run the production build (not run here). Until step 1 the site shows no Share and every `/d/` link
   says "This deck is not shared any more."; nothing looks broken.
4. No new env var is needed. `study.tryplumi.app` must already be attached to the Vercel project (the app needs that anyway).

## What was run, and what was not

* Run: `tsc --noEmit`, `eslint src`, `app:test` (680), `library:test` (283), `dark:test` (16), `sharing:test` (69), `sharing:contract`
  (matches the real CONTRACT.json).
* Browser (Playwright, Chrome, dev server) against a **fake Supabase** stub: yes. 1180x820, 820x1180, 390x844. Public page server
  rendered with cards in HTML; flip by tap, button, Space, Enter; next/back/arrows; progress dots and bar; 1,500 character cards;
  500 cards; Add to my decks (appears in /study/flashcards with the same cards, original untouched, Already added, re-add after
  delete); Report; not-found variants (unknown, stopped, hidden, everything not_found, rate_limited, migration missing, server down);
  migration-missing hides Share in the app; Share flow (copy, stop, Shared tag, list, limit lines, offline retry, anonymous);
  light mode only under a dark preference; no horizontal scroll; no console errors except injected failures; no em dashes; contrast
  at least 4.5:1; 3px focus ring; 44px controls; reduced motion cross-fade; the page talks to its own host only.
  The scripts are in the session scratchpad (`.../scratchpad/shares/{stub,pub,app}.js`), not in the repo; screenshots in `shares/shots/`.
* **Not run:** real Supabase, `next build`, a real iPad or phone (`navigator.share` and iOS Safari behaviour of the flip are
  untested), production headers (the `Cache-Control` rule in next.config.ts is only seen in dev, where Next overrides it), a Vercel
  deploy, and "Supabase not configured" in a browser (unit tests only).

## Decisions where the brief was silent

* **Make a link is a separate tap** after opening the Share sheet, not automatic: it spends the daily quota and publishes text.
* **Open my decks** after adding goes to the app's flashcards page, which has its usual sign-in door: a friend who added without an
  account must sign in to see the copy. It stays in this browser's storage meanwhile.
* **tryplumi.app/d/<code> redirects to study.tryplumi.app**, because the copy must land in the app host's storage.
* A deck that is not there returns HTTP 200 with the not-shared page (`notFound()` caused a React console warning in dev).
* The copy keeps shared card text up to 1,500 characters, not cut to the usual 400/800; editing a card later cuts it to those.
* The deck's subject label is sent as `p_subject_hint`; on adding it becomes the deck's subject only if the app knows it.
* The link is a snapshot: editing the deck afterwards does not change it, and there is no "update link" (that needs a new code).
* The probe uses `my_shared_decks` when signed in (200, no console noise) and `get_shared_deck` with a made-up code otherwise.
* `/d/` is left out of `SiteOnly`'s furniture so no analytics sees which deck is opened.

## Unknowns and risks

* Does the migration delete shared decks when an account is deleted? The privacy policy says so: please confirm in 0130.
* Report reasons sent are `not_school_work`, `rude`, `other` (the contract takes free text).
* `Cache-Control: private, no-store` on `/d/:code` and `force-dynamic` in production need a look on a Vercel preview.
* If a browser blocks storage, Add to my decks works for the visit only.
* The server allows 60 successful lookups a minute per caller; beyond that the page shows the not-shared state.

Paid model calls: 0.
