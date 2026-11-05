# Adding a question bank

The steps every new bank has followed, so a session can start here instead of working them out again.
`docs/seo/question-bank.md` has what every bank shares and `docs/question-bank/banks/` each bank's own notes.
`scripts/question-bank/tag.md` has the tagging brief and `scripts/question-bank/tag/` each bank's additions to it.

## 1. Before you start

- `npm run bank:status -- <board> <level> <subject>` shows whether it's live or has an open PR. It reads your
  checkout, so run it after `git fetch` on an up-to-date branch.
- Check `src/content/pastPapers.json` for a library slug, and match its naming.
- Work in your own worktree on your own branch off `origin/main` (see `AGENTS.md`).
- Sources are the board's own public website. A gap only a third-party mirror could fill is a question for
  Daniel: explain the options and wait. One subject's approval doesn't extend to another.

## 2. Build it from the closest bank

Copy the pipeline of the closest bank into `scripts/question-bank/<board_subject>/`: usually fetch, spec, cut,
tag and build scripts. Reuse the board's existing fetcher, cutter and scheme reader rather than forking them. If
you must change a shared script (`cut.py`, `cut_pearson.py`, `setups.py`, ...), say so in the PR, because the
change reaches every bank that uses it.

Each part needs:

- marks, topics from the specification, and a scheme crop (`ms`) or key (`k`)
- examiner's report notes (`er`) where the board publishes them
- its setup: text printed above a part's label goes with that part (`setups.py`)
- any sources it quotes visible with it, using stems or inserts as other banks do
- its own audio, for listening questions, and tiers paired in `tiers.json` where the paper has tiers

Keep each option a separate paper, so students can filter to the ones they study.

## 3. Register it

There's nothing to register: a meta in `src/content/questionBank/` is a live bank. `scripts/question-bank/bank-registry.mjs`
finds it and writes the gitignored `src/content/questionBank.generated.ts`, whenever `next` starts and before
`npm run typecheck`. In a dev server that's already running, `npm run bank:registry` picks up a new meta. The bank's
search query, `<board> <level> <subject> questions by topic`, goes in the keyword map from the meta too. A new bank goes
after the existing ones, by slug, wherever the site's lists aren't sorted.

A bank only adds its own files, so parallel banks can't conflict:

| File | What it holds |
| --- | --- |
| `src/content/questionBank/<slug>.json` | written by your builder |
| `docs/question-bank/banks/<slug>.md` | the bank's notes: series, counts, gaps, how it was built |
| `scripts/question-bank/tag/<slug>.md` | how its tagging differs from the brief in `tag.md` |
| `scripts/question-bank/<board_subject>/` | its pipeline |

Several banks built together can share one notes file, named for the group, with a line listing their slugs as
`docs/question-bank/banks/ocr-b-sciences.md` does. `bank:status -- --check` fails a bank with no notes.

Don't edit `questionBank.ts`, `routes.ts`, `tag.md` or `docs/seo/question-bank.md` for a bank. Only a new subject touches
shared code, and both of these are optional, because each has a default:

| File | What to add |
| --- | --- |
| `src/components/cosy/Book.tsx` | a colour |
| `src/components/questionBank/QuestionBank.tsx` | a search placeholder |

A new board or level does need `questionBank.ts`, for its type and `bankOwner`, and the sort orders in `BankPages.tsx`
and `CosyHome.tsx`.

Started your branch before this rule, and it conflicts on those files? Take `origin/main`'s version of each, then move
your additions to your bank's own files.

Link to the bank's past paper library page and back, if it has one.

## 4. Upload

```bash
python3 scripts/question-bank/upload_r2.py <work-dir>
npm run bank:data -- <slug> --verify
```

`--verify` reads the files back. Commit only the meta's hashes: the data itself stays out of git.

## 5. Check it

```bash
npm run bank:check -- <slug> --img <work-dir>/img
npm run bank:status -- --check
npm run lint && npm run typecheck
npx next build
```

Then:

- **Read the sheets `bank:check` writes.** Look for bleed from the next question, cut-off lines, schemes that
  span pages, passages lost from gap-fills and translations, and sources missing from their questions. Numbers
  have passed cutters that merged questions.
- Open the bank and a topic page locally, using each filter. Check the console for errors on `bank-data` files:
  when data fails, the heading and a built-in sample still look right.
- Delete `.next` when you're done. A full build is about 2.8 GB.

## 6. The PR

One PR to `main` listing series, counts, gaps and anything odd, including any `WARN` lines you looked at. Don't
merge it: report the link and the counts.

## Re-cutting a live bank

A re-cut is judged by what it does to live crops, so follow the steps at the top of
`scripts/question-bank/recut_compare.py`.

- Crops are cached for a year as immutable. A changed image needs a new `cropVersion`, which
  `recut_compare.py apply` sets.
- Upload just before the merge, never days ahead and never after. A `cropVersion` that goes live before its crops
  caches the old crop under the new address for a year, and new crops with old rows are drawn squashed in the
  study feed.
- Read uploads back by ETag before merging. A background upload has died silently before.
- Compare against a baseline from the same cutter (`recut_compare.py --base`). Another PyMuPDF version alone can
  make hundreds of crops look changed.
- Do bulk reads through the S3 API with `.env.local`'s keys. The public `r2.dev` address returns 429 at about 45
  requests a second, and students use it.
- List the words that move before cutting images, and read samples of the biggest changes by eye.
