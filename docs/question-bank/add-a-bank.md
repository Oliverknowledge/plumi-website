# Adding a question bank

The steps every new bank has followed, so a session can start here instead of working them out again.
`docs/seo/question-bank.md` has the history and each bank's own notes. `scripts/question-bank/tag.md` has the
tagging brief.

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

These are the files every bank touches, and the ones most likely to conflict with a parallel bank. Keep your
edits small, and merge `origin/main` before opening the PR.

| File | What to add |
| --- | --- |
| `src/content/questionBank.ts` | the import, the name in `bankSubjects`, the header comment, and the subject in `BankSubject` if it's new |
| `src/content/questionBank/<slug>.json` | written by your builder |
| `src/config/routes.ts` | the bank's search queries in `secondaryQueries` |
| `src/components/cosy/Book.tsx` | a colour, if the subject is new |
| `src/components/questionBank/QuestionBank.tsx` | a search placeholder, if the subject is new |
| `scripts/question-bank/tag.md` | the bank's tagging notes |
| `docs/seo/question-bank.md` | the bank's section: series, counts, gaps |

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
