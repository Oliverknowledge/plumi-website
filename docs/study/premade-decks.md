# Ready-made decks (Biology, Chemistry, Physics)

The Flashcards page's "Ready-made decks" sheet is a catalogue: for each of Biology, Chemistry and Physics, two kinds of module deck, named as on the iPad, plus the five free hand-written starters under "Free starters".

- **Key wording · <module>**: Plumi's own definitions (the iPad's `*_definitions.json`), A-level only. DRAFT, see below.
- **Mark scheme · <module>**: the exam boards' own mark scheme wording from past papers (the iPad's `markscheme_cards_<spec>.json`), A-level and AQA GCSE. Critic-approved on the iPad, not DRAFT. See "Mark scheme cards" at the end.

The module decks come from the iPad app's files, so the web and the iPad teach the same words.

## Status: DRAFT

All three source files are marked `review.status: DRAFT`. **No subject teacher has signed them off.** The sheet says so (it carries the starters' honest note: written by Plumi, not yet checked by a teacher, check a card against your own spec and edit it if it differs). Do not describe these decks to students as checked.

## Source

Read from the iPad repository's `Sources/PlumiKit/Resources/` (read-only; the website never depends on it at runtime):

| Subject | File | Placed by |
| --- | --- | --- |
| Biology | `biology_definitions.json` | each card's `topics` (spec id to topic codes; the first code files it) |
| Chemistry | `chemistry_definitions.json` | the same |
| Physics | `physics_definitions.json` | the card's `skill`, through `canonical_skills_physics.json` (first mapped topic on each board) |

Module names are the iPad's own topic trees (`topics_*_bio_*.json`, `*_chem_*`, `*_phys_*`): the root of the topic a card is filed under. Nothing is invented. Economics (`economics_definitions.json`) is not built yet. Physics' concept-library cards (`physics_concepts.json`) and the one Edexcel "your board wants the term" line (`boardTerm`) are not carried.

Boards: Biology AQA 7402, OCR H420, Edexcel 9BN0 (Salters-Nuffield); Chemistry AQA 7405, OCR H432 (A), OCR H433 (B Salters), Edexcel 9CH0; Physics AQA 7408, OCR H556, Edexcel 9PH0. There is no GCSE set. A card appears only on the boards that list it.

## Rules the build enforces

- One deck per module of a specification, in the specification's own module order; modules with no cards are left out. Cards keep the iPad's order.
- A card's text is carried exactly: the prompt as written; the answer with its `required` key words wrapped in `**bold**` and its first letter capitalised, both as the iPad does (`KeyWording.bolded`, `capitalised`), and nothing else changed.
- **Held back:** every id in a file's `sign_off` list is left out. Today: Biology `BIO.RHODOPSIN`, `BIO.CRITICAL_PERIOD`, `BIO.DEPRESSION`, `BIO.CANCER_OESTROGEN`, `BIO.CYSTIC_FIBROSIS`, `BIO.EXERCISE_IMMUNITY`; Chemistry `CHEM.IDEAL_GAS`, `CHEM.ARRHENIUS`, `CHEM.LATTICE_ENTHALPY`. They are listed in each output file's `held` and printed by the build.
- A card no board's tree can place is skipped and listed in `unmapped` (none today).
- The build fails on an em dash in any card or module name, a module name over 50 characters (a deck name is cut at 50), or a repeated id.

## Where it lives

- `scripts/premade-decks/build.ts`, with the pure builder in `src/lib/studyapp/premadeBuild.ts` (tested).
- Output: `src/content/premadeDecks/{biology,chemistry,physics}.json` (public, lazy-loaded), about 170 KB in all. Deterministic (no dates, fixed order); each records the SHA-256 of every source file it used.
- `src/lib/studyapp/premade.ts` loads one subject at a time by dynamic import, only when the student opens that tab. None of it is in the study app's first load.
- A deck added to the student's own list keeps a stable id on `deck.starter` (`pm:<subject>:<spec>:<module>`), so it is never added twice, is not shareable as theirs, and is theirs to edit.

## Rebuild

```bash
npm run decks:build                                  # default source: /home/user/plumi/Sources/PlumiKit/Resources
npm run decks:build -- --src /path/to/Resources      # or set PLUMI_RESOURCES
npm run decks:build -- --check                       # CI: with the source beside it, byte-compares; without it, checks the committed data's shape
```

Rebuild whenever the iPad's definition or topic files change, and commit the three JSON files. CI runs `--check` without the iPad's files, so it catches a broken or hand-edited output but not a source that moved on; run the check locally against the iPad repo before a release.

## Board awareness

The Questions setup holds the student's subjects as bank slugs, which name the board (`ocr-a-level-biology-a`). The catalogue opens each subject on that board, with a "yours" tag, and the other boards one tap away. With no board known for a subject, nothing is guessed: it asks "Pick your board". A slug the iPad has no definitions for (OCR or Edexcel Biology B, any GCSE, CIE, WJEC) counts as no board.

## Pro: the Mark scheme decks (enforced on the server)

**Founder decision (6 November 2026): Mark scheme decks are exclusively Pro.** No taster, no switch. Key wording decks and the five free starters stay free.

What a student sees: the Mark scheme group is marked "Pro". Everyone sees the deck names and card counts (a public index, `src/content/premadeDecks/markscheme-index.json`: names and numbers only). Locked decks carry a Pro tag; tapping one shows the calm panel ("Pro is bought in the Plumi app on iPad, then it works here when you sign in", a Sign in link only when signed out, no price and no purchase link: Apple's steering rules). While the answer is loading the tiles are neutral, never locked and then opened.

**The text is not in the website's public output.** The cards (`src/content/proDecks/markscheme-<spec>.json`, built by `decks:build`) are read only by the route handler, through `src/lib/studyapp/proDecksLoader.ts` (`import "server-only"`, so a client import is a build error). Nothing in the client bundle, `.next/static` or `public/` holds them. Proof after any `next build`:

```bash
npm run build && npm run decks:leak-check    # searches .next/static, the study app's prerendered pages and public/ for 870 phrases from the answers; fails on any hit
```

`proServer.test.ts` also fails if anything but the loader imports `content/proDecks`, or if the loader is imported by anything but the route.

**How a Pro student gets them.** The client sends `Authorization: Bearer <Supabase access token>` to `GET /api/premade/markscheme/<spec>` (spec: one of the ten lowercase ids, e.g. `ocr-h556`; anything else is 400 before anything else is asked). The server verifies the token with Supabase (`/auth/v1/user`), reads that user's own `account_entitlements` row with the caller's own token (row-level security allows only own rows), and returns the JSON only if the record grants Pro; otherwise 403 with a tiny body (401 for no or rejected token, 503 if Supabase cannot be asked). `Cache-Control: private, no-store`; nothing is logged; a light per-token limit (60 a minute). `GET /api/pro-status` answers `{pro:true}` or 403 the same way and drives the lock on the tiles (cached for the visit; an error is free, quietly, and asked again after a minute).

**The entitlement rule** is migration 0127's `account_pro_live`: status `active` grants while `expires_at` is in the future; `grace` while `expires_at` is less than two days ago; `expired`, `revoked`, no row, or an anonymous user never grant. **Where it differs from `account_pro`:** the web does not call that function and ignores its three-device limit, because the function would record the website as a device and use up one of the account's three slots. It uses the app server's clock, not the database's `now()` (a few seconds of skew at an expiry edge).

**What a Pro student keeps.** Adding a deck copies its cards into the student's own flashcards (on their device), where they are theirs to review and edit. If Pro lapses the decks they already added stay; they simply cannot add more. The decks are not shareable (they are marked as ours).

**How to verify with a real Pro account** (not done here: no production Supabase was called): apply migration 0127 and confirm an `account_entitlements` row for the test account (`status = 'active'`, `expires_at` in the future); sign in to the website as that account; open Flashcards, Ready-made decks, Biology, Mark scheme: tiles should show a plus, and tapping one should add the deck. Then in a private window, signed out, check the tiles are locked, and `curl -i https://<site>/api/premade/markscheme/aqa-7402` is 401. With a free account's token it is 403. Check the project's `NEXT_PUBLIC_PLUMI_SUPABASE_URL` and `_KEY` are set on the host (the route reads the same public variables as the browser).

## Analytics

`premade_opened`, `premade_deck_added` (`subject`, `deck`, `group`), `premade_locked_tapped` (`subject`, `deck`, `group`). No personal data.

## Bold key words

Each key wording card's answer carries its `required` words as `**bold**` markers, written by the build exactly as the iPad's `KeyWording.bolded` does: longest phrase first, first occurrence only, ignoring case, never inside a run already bold; a phrase the answer lacks is added as a "Key words:" line (one card does: BIO.INTRONS, where "coding sequences" is bolded inside "non-coding sequences" and then "non-coding" can no longer be found; the iPad draws the same). The capital goes after the markers. The `accept` map plays no part. The web draws `**x**` as bold on every card face, the editor list and shared decks (a student can type it too; the editor shows it as typed). Only balanced pairs are bold; the iPad bolds a last unclosed `**` to the end, the web keeps a stray one literal.

## Mark scheme cards

Source: the iPad repo's `local-dev` branch (not yet on `plumi`), `Sources/PlumiKit/Resources/markscheme_cards_<spec>.json` for AQA 7402, 7405, 7408, 8461, 8462, 8463, Edexcel 9PH0, OCR H420, H432, H556: 1,166 cards, all placed in 76 module decks. Make a read-only copy and point the build at it:

```bash
git -C /path/to/plumi archive origin/local-dev Sources/PlumiKit/Resources | tar -x -C /tmp/ms
npm run decks:build -- --ms-src /tmp/ms/Sources/PlumiKit/Resources     # writes src/content/proDecks/markscheme-<spec>.json and the public index
```

A card is filed under the first of its topic codes that finds a module of that board's tree (the iPad's `MarkSchemeDecks.groups`, including its try-with-`PH.`-and-one-level-up rule). The front is the question, a blank line and `[n marks]`; the back is each marking point on a line led by `• ` (a line ending in a colon introduces points and is not one), then the board's own lines led by `Also accept: `, `Not accepted: `, `Ignore: `, `Note: `; `**` wraps the words the board underlines. This is the iPad's plain text (`MarkSchemeText`), carried verbatim; the web stores nothing more and reads the leads back for display (lib/studyapp/markscheme.ts), so an edited card still shows its bands. `term`, `asked` and `sources` are not carried. A few cards run past the usual 400 and 800 characters, so a catalogue deck's cards may hold 700 and 1,200 and its name 64 (`PREMADE_LIMITS` in model.ts); a student's own decks keep 400, 800 and 50.

Drawn as on the iPad: the question with a small marks tag; the answer as points with dots, the board's key words heavy in the accent, "or" between alternatives, and under it quiet bands ALSO ACCEPT (green), NOT ACCEPTED (red), IGNORE (grey) and MARK SCHEME NOTE (accent). The page's dark mode turns the page over but keeps hues, so the bands stay green, red and grey. The answer is set at the largest size that fits the card, then smaller, then scrolls (the iPad's `ViewThatFits`).

**Licence.** These cards reproduce each exam board's own mark scheme wording verbatim. The question bank already shows the same schemes as pictures. The founder should decide whether the text form is acceptable before the mark scheme group is switched on for students.

**Superscripts and subscripts.** The iPad's mark scheme text writes them as `^{...}` and `_{...}` (`3.0 × 10^{8} **m s^{-1}**`, `SO_{4}^{2-}`, `^{12}C`), the grammar in the iPad handoff `.context/handoffs/markscheme-scripts.md`: braces always, no nesting, a `^` or `_` without `{body}` and an unclosed brace are ordinary text, a body is trimmed (`PO_{4}^{ 3-}`), and bold is read first so a script may sit inside a bold run. The web draws them as `<sup>` and `<sub>` (BoldText.tsx; a screen reader hears a superscript as "to the power of"), never as Unicode superscripts, and never reads a `^` or `_` outside braces, so a student's own `2^3` stays as typed. The 1,166 cards hold 1,106 script marks in 214 cards. The web does not guess exponents: the data is right at source (the iPad's `tools/markscheme-cards/scripts.py`, `verify_bundle.py`).

**Source of truth.** The mark scheme files are in the iPad repo's worktree/branch that carries the superscript fix (`/home/user/msfont` on 6 November 2026; local, not yet on `origin/local-dev`). Rebuild with `npm run decks:build -- --ms-src <that folder>/Sources/PlumiKit/Resources` (the build only reads it). `decks:build -- --check` compares byte for byte when `--ms-src` (or `PLUMI_MS_RESOURCES`) points at the files, and otherwise checks the committed data's shape (including that every script brace is closed) and says it did not compare.

The mark scheme group is Pro only: see "Pro: the Mark scheme decks" above.
