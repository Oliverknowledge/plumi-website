# Topic analysis

In the study app's Questions feed, a subject can offer **Topic analysis**: for each topic, how many questions the papers in Plumi hold, in which exams, and in what form they are asked (recall, describe, explain, calculate, suggest, compare, draw or complete, extended response, multiple choice). It is counts of the bank, nothing more: no model, no network, no prediction. The wording says "in the papers in Plumi" and never "never asked".

Live for: `ocr-a-level-biology-a`.

## What is where

| File | What it does |
| --- | --- |
| `src/lib/studyapp/questions/questionForm.ts` | The classifier. Rules are documented at the top of the file. Unsure is `other`. Not marking. |
| `src/lib/studyapp/questions/__fixtures__/questionForm.*.json` | 100 parts read and labelled by hand (50 to develop on, 50 held out). `questionForm.test.ts` fails if precision on what it commits to drops under 90%. |
| `scripts/question-bank/build-insights.ts` | `npm run bank:insights -- <slug>` reads the bank's `parts` and `text` data from R2 by the hashes in its meta and writes the two files below. `--check` says whether they are out of date. |
| `src/content/questionBankInsights/<slug>.json` | The counts and the part-to-form map (about 27 KB). Loaded only when a student opens the analysis, filters by form, or after a quiet second on that subject's feed. |
| `src/content/questionBankInsights/index.json` | One line per subject: the `parts` hash its file was built from. The app offers the analysis only while that matches the bank's meta, so a bank cut again stops showing a stale analysis until this is run again. |

It is a sibling of `src/content/questionBank/`, not inside it: `next.config.ts` reads every entry of that folder as a bank meta.

## Adding a subject

1. The bank needs `parts` and `text` data files (`data.parts`, `data.text` in its meta) and topics.
2. `npm run bank:insights -- <slug>`, then read the "other" share and spot-check some parts before trusting it. The rules were written for OCR A-level Biology A; another board's wording may need a rule or two and a new labelled fixture.
3. Commit both files. After any re-cut of the bank, run it again: CI runs `npm run bank:insights -- --check` (in `.github/workflows/checks.yml`, beside `bank:status -- --check`), which fails when a bank's insights were built from older data than its meta names. It reads only the checkout, so it needs no network. `npm run bank:insights -- <slug> --check` goes further and rebuilds from R2 to compare the bytes.

## What is counted

A **part** is one lettered part of an exam question: the unit the feed lists and counts, and the number every screen shows (the feed calls it a "question"). A **question** is the numbered question its parts share; the file keeps both (`p` and `q`). A part tagged with two topics counts under each.
