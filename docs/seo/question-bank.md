# The question bank

`/question-bank`, one bank per subject, and a page per spec topic. Built 23 October 2026.

Every question from AQA's published A-Level Biology (7401/7402), Chemistry
(7404/7405) and Physics (7407/7408) papers, 2016–2025: about 6,400 question parts,
each cut out of its paper, paired with its own mark scheme rows, tagged to the
specification topic it tests, with the examiner's report on its question.

| URL | For |
| --- | --- |
| `/question-bank` | "A-Level question bank" |
| `/question-bank/aqa-a-level-chemistry` | "AQA A-Level Chemistry questions by topic" |
| `/question-bank/aqa-a-level-chemistry/<topic>` | "AQA A-Level Chemistry <topic> exam questions" |

The past paper library's AQA A-Level Biology, Chemistry and Physics pages now
serve our own copies of AQA's papers too, with AQA's examiner's reports.

## Where everything lives

- **Source papers:** AQA's own site. `scripts/question-bank/fetch_aqa.py` reads
  each specification's assessment-resources page (which lists June 2024 and 2025)
  and AQA's file store for older series.
- **Files we serve:** Cloudflare R2, at `NEXT_PUBLIC_PAPERS_URL`. Whole papers under
  `aqa/`, question crops under `bank/`. In development they're served from
  `public/papers-local` (a symlink into the gitignored work folder).
- **Data the site reads:** `src/content/questionBank/*.json` (topics, papers,
  series, the newest 20 parts; built into the pages) and
  `public/question-bank/<subject>/{parts,text,reports}.json` (fetched by the
  browser: the list, search text, examiner's reports).

## Gaps, honestly

- AQA no longer publishes Biology Paper 1 for 2017–2019 or Paper 3 for June 2018,
  so they aren't here.
- Five older AS sets (Chemistry June 2016 and 2018, Physics June 2016–17) use a
  mark scheme layout the cutter doesn't read; their questions link to the whole
  mark scheme PDF instead of a cropped row.
- Marks add up exactly for 181 of 190 papers; the rest are a few marks short,
  and those parts show no mark count rather than a wrong one.

## Refreshing after a summer series

```bash
pip install pymupdf pillow boto3
npm run bank:fetch      # new papers from AQA (cached)
npm run bank:spec       # only if AQA revises a specification
npm run bank:cut        # cut every paper (about 10 minutes); --only=74051 for one paper
python3 scripts/question-bank/tag_batches.py split   # then tag the new batches, see scripts/question-bank/tag.md
python3 scripts/question-bank/tag_batches.py merge
npm run bank:build
npm run bank:upload     # to R2; needs the keys in .env.local (see upload_r2.py)
```

Then build, check a subject and a topic page, commit the JSON, and resubmit the
sitemap in Search Console.

## Edexcel Maths and Further Maths

`/question-bank/edexcel-a-level-maths` and `/question-bank/edexcel-a-level-further-maths`:
every question from Pearson Edexcel's current specifications, 9MA0 and AS 8MA0
(Maths) and 9FM0 and AS 8FM0 (Further Maths). That is 447 Maths questions from 47
papers and 824 Further Maths questions from 128 papers, cut whole question by
question, because Edexcel's mark schemes and examiner's reports go by question.
Topics follow the specification's numbered areas, with no Year 1 and Year 2 split.
The legacy modules (C1–C4, FP1–3, M1–5, S1–4, D1–2) are left out on purpose.

- **Source papers:** `fetch_edexcel.py` asks the public search index behind
  Pearson's course-materials pages for each spec code. Whole papers are stored on
  R2 under `edexcel/`, and crops under `bank/` next to AQA's.
- **Gaps:** Pearson keeps the June 2018 9MA0/8MA0 papers and June 2026 for
  teachers only. June 2019 9MA0 Paper 3 and 9FM0 Further Mechanics 1, plus the
  2018 AS Decision papers, are scanned images, so they're in the past paper
  library but not the bank. Every question has its marks, and all but 41 have a
  cropped mark scheme. The rest link to the whole scheme.

```bash
npm run bank:fetch:edexcel
npm run bank:cut:edexcel
python3 scripts/question-bank/tag_batches.py split scripts/question-bank/.work-edexcel   # then tag
python3 scripts/question-bank/tag_batches.py merge scripts/question-bank/.work-edexcel
npm run bank:build:edexcel
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work-edexcel --pdf-prefix=edexcel/
```
