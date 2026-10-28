# The past paper library

`/past-papers` and the pages under it. Rebuilt 24 October 2026 from our own copies.

## What it is

Maths, Further Maths, Biology, Chemistry and Physics past papers, mark schemes and
examiner's reports at GCSE, IGCSE and A-Level, for every board we cover: AQA,
Edexcel (with International GCSE and International A-Level), OCR, OCR MEI, WJEC,
Eduqas and Cambridge. That's 60 board pages across 9 subjects.

**Every file is ours.** Each one is the board's own published PDF, fetched from
that board's website, stored in our R2 bucket and served from it. No page links
to Physics & Maths Tutor or to any other copy. The pages credit the board whose
paper it is.

| URL | Primary query |
| --- | --- |
| `/past-papers` | GCSE and A-Level past papers |
| `/past-papers/a-level-chemistry` | A-Level Chemistry past papers |
| `/past-papers/a-level-chemistry/ocr` | OCR A-Level Chemistry past papers |

Board slugs: `aqa`, `edexcel`, `ocr`, `ocr-mei`, `eduqas`, `wjec`, `cie` (Cambridge
International A-Level), `edexcel-ial`, `cie-igcse`, `edexcel-igcse`.

## Where everything lives

- **Fetchers:** `scripts/past-papers/boards/<board>.py`, one per board, all writing
  the same manifest (see [boards/README.md](../../scripts/past-papers/boards/README.md)).
  Each board's `.work/<board>/gaps.md` (gitignored, written on every run) says
  what that board doesn't publish publicly.
- **Data:** `scripts/past-papers/build.py` writes `src/content/pastPapers.json`.
- **Bank pages:** these pages come from the question bank's own file lists in
  `src/content/pastPapers.ts`, not from `pastPapers.json`: AQA A-Level Biology,
  Chemistry and Physics, and Edexcel A-Level Maths, Further Maths, Biology,
  Chemistry and Physics.
- **Files:** R2, under `aqa/`, `edexcel/`, `ocr/`, `ocr-mei/`, `wjec/`, `eduqas/`
  and `cie/`.

## What the boards keep back

We only take what a board publishes openly, never anything behind a teacher
login.

- **Every board** publishes a sitting some months after it's sat, so June 2026
  isn't here yet anywhere.
- **Cambridge** publishes only one recent sitting (May/June 2024, one variant
  of each paper), its examiner report, the specimen papers, and grade thresholds
  from 2022. Everything else is on its School Support Hub, for schools. Cambridge
  pages say so in a note under the lead.
- **Eduqas GCSE Biology, Chemistry and Physics** are no longer on Eduqas's site,
  so they have no page.
- **Older specifications** are included where the board still hosts them (OCR
  back to 2014, Pearson's International GCSE 4xx0, WJEC GCSE Maths 3300/3310).
  Specs a board has taken down aren't here.
- **Left out by design:** modified, large-print and Braille papers, Welsh-medium
  copies, answer booklets, errata, and large data sets in spreadsheet form.

## Decisions worth knowing

- **One page per board, not per paper.** ~60 substantial pages rather than ~600
  near-identical ones. Each paper still has its own anchor and its own heading
  with the component code. See [content-plan.md](./content-plan.md).
- **Versions of a paper share a card.** Cambridge's time-zone variants and
  Pearson's "R" papers are rows on one paper's card, labelled by version.
- **Whole-spec files** (examiner's reports that cover every paper, grade
  thresholds, sample assessment materials) get a card at the end of their group.
  Spec-wide data and formula booklets are linked on every paper's card.
- **Legacy specifications fold away** in `<details>` below the current ones,
  unless the current spec has only sample papers so far (WJEC GCSE Maths 3320).
  Then the older papers stay open and first.
- **Tracking:** opening any file fires `paper_opened` (`page`, `paper`, `kind`,
  `session`).

## Refreshing after a series

```bash
npm run papers:fetch     # every board; cached, so only new files download
npm run papers:build
npm run papers:upload    # to R2; needs the keys in .env.local
```

Then build the site, check a board page or two, commit `src/content/pastPapers.json`,
and resubmit the sitemap in Search Console.
