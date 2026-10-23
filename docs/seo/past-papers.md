# The past paper library

`/past-papers` and the 72 pages under it. Built 23 October 2026.

## What it is

Every Maths, Further Maths, Biology, Chemistry and Physics past paper and mark
scheme that [Physics & Maths Tutor](https://www.physicsandmathstutor.com/past-papers/)
lists, at GCSE, IGCSE and A-Level: 29,547 files across 9 subjects and 63 boards.

| URL | Primary query | Count |
| --- | --- | --- |
| `/past-papers` | GCSE and A-Level past papers | 1 |
| `/past-papers/a-level-chemistry` | A-Level Chemistry past papers | 9 |
| `/past-papers/a-level-chemistry/aqa` | AQA A-Level Chemistry past papers | 63 |

Board slugs: `aqa`, `edexcel`, `ocr`, `ocr-mei`, `eduqas`, `wjec`, `cie` (CAIE
A-Level), `edexcel-ial`, `cie-igcse`, `edexcel-igcse`.

## Decisions worth knowing

- **One page per board, not per paper.** ~60 substantial pages rather than ~600
  near-identical ones. Each paper still has its own anchor (`#a-level-7405-paper-1`)
  and its own heading with the component code, so "AQA chemistry paper 1 2024"
  can still land on the right card. See [content-plan.md](./content-plan.md) on
  scaled content.
- **Where the files come from.** AQA A-Level Biology, Chemistry and Physics are
  our own copies of AQA's published papers, served from R2 (see
  [question-bank.md](./question-bank.md)), with AQA's examiner's reports. Every
  other board still links to PMT's copy (opens in a new tab) and credits PMT; if
  PMT ever blocks hotlinking, link the paper card to `paper.source` (PMT's page).
- **Legacy specifications fold away** in `<details>` below the current ones. They
  stay in the HTML, so they are still indexed. Long histories (Cambridge runs past
  100 sittings) show the latest 12 and fold the rest.
- **No examiner reports.** PMT doesn't carry them, so no page claims them.
- **The CTA follows the homepage's truth rules**: A-Level papers are in the app's
  Papers tab and Pro marks a whole paper; a GCSE paper goes in as a PDF.
- **Tracking:** opening any file fires `paper_opened` (`page`, `paper`, `kind`,
  `session`). The App Store and Discord keys use the usual `cta_clicked`
  placements, `papers-<subject>-<board>`.

## Refreshing after a summer series

```bash
rm -rf scripts/past-papers/.cache && npm run papers:crawl && npm run papers:build
```

Then build, check a board page, and commit `src/content/pastPapers.json`.
Search Console: resubmit the sitemap.
