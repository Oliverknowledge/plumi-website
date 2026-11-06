# Ready-made decks (Biology, Chemistry, Physics)

The Flashcards page's "Ready-made decks" sheet is a catalogue: module decks for A-level Biology, Chemistry and Physics, plus the five free hand-written starters under "Free starters". The module decks come from the iPad app's definition files, so the web and the iPad teach the same words.

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
- A card's text is carried exactly: the prompt as written, the answer with its first letter capitalised (as the iPad does) and nothing else changed.
- **Held back:** every id in a file's `sign_off` list is left out. Today: Biology `BIO.RHODOPSIN`, `BIO.CRITICAL_PERIOD`, `BIO.DEPRESSION`, `BIO.CANCER_OESTROGEN`, `BIO.CYSTIC_FIBROSIS`, `BIO.EXERCISE_IMMUNITY`; Chemistry `CHEM.IDEAL_GAS`, `CHEM.ARRHENIUS`, `CHEM.LATTICE_ENTHALPY`. They are listed in each output file's `held` and printed by the build.
- A card no board's tree can place is skipped and listed in `unmapped` (none today).
- The build fails on an em dash in any card or module name, a module name over 50 characters (a deck name is cut at 50), or a repeated id.

## Where it lives

- `scripts/premade-decks/build.ts`, with the pure builder in `src/lib/studyapp/premadeBuild.ts` (tested).
- Output: `src/content/premadeDecks/{biology,chemistry,physics}.json`, about 160 KB in all. Deterministic (no dates, fixed order); each records the SHA-256 of every source file it used.
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

## The Pro gate (built, OFF)

`src/lib/studyapp/pro.ts`. `PREMADE_GATE_ON` is false unless the build sets `NEXT_PUBLIC_PREMADE_GATE=on`; while off, nothing asks the server and every deck is open.

When on: a student who is not Pro sees every module deck with a "Pro" tag except one taster per board (the first deck with at least 10 cards, tagged "Free"). Tapping a locked deck opens a calm panel: what Pro adds, and "Pro is bought in the Plumi app on iPad, then it works here when you sign in." There is no price, no purchase link and no "cheaper on the web" wording (Apple's steering rules). The free starters are never gated.

How Pro is decided: the Supabase RPC `account_pro(p_device_id)` (migration 0127) as the signed-in student. `pro: true` is Pro. Signed out, anonymous, an error, an odd answer or no Supabase config is free for gated decks (fail closed), never an error on screen. Unknown while the answer is on its way (decks do not flash locked, and a tap waits for the answer). A real answer is kept for the visit; an error is asked again after a minute.

Caveat before turning it on: `account_pro` counts the asking device against the account's three (0127, rule 4). The website therefore asks as one fixed id (`plumi-web-browser`), so all of a student's browsers take one slot, but that is still a slot. If that is not wanted, read the student's own `account_entitlements` row instead (RLS allows it) and apply the same live rule; only `ProGate`'s transport changes.

## Analytics

`premade_opened` (`gate`), `premade_deck_added` (`subject`, `deck`, `gated`), `premade_locked_tapped` (`subject`, `deck`). No personal data.
