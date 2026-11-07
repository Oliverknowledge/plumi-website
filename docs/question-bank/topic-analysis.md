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

## Angles (Pro)

On a topic page each form has an **Angles** button (a lock with the Pro tag for anyone who is not Pro; `usePro`, `ProGate`, feature id `angles` in `src/lib/pro/features.ts`). Opened, it shows one fact line, how the board words it, and up to four real examples, each opening to the board's question and mark scheme pictures (`Crop`, so tap to zoom).

- **Data:** `npm run bank:insights -- <slug>` also writes `src/content/questionBankInsights/<slug>.angles.json` and `angles.json` (the index). Per topic and form: `p` the opening phrases with counts (`openingPhrases` in `angles.ts`, from `askWords` in `questionForm.ts`), `e` the example ids (`pickExamples`). It is a separate lazy chunk (about 17 KB), loaded only when a Pro student opens a panel.
- **Phrases:** the words of the ask from the command word on, cut at a number, bracket or "fig"; a phrase is shown only if at least two real questions open with exactly those words, it does not end on a joining word ("the", "of"), a longer phrase replaces a shorter one it makes up most of, at most four. Multiple choice has none. Nothing is reworded.
- **Examples:** a part of that form on that topic with its own mark scheme picture (`ms`, not a whole-question scheme `msq`), whose text was read whole, whose ask was found at the start of a clause, and that does not lean on another part ("your answer to part (i)"). Chosen to spread across exams and marks, steadily (hash of the id). The build stops if an example breaks these rules.
- **Checks:** `angles.test.ts` (ids are real parts of the form they are listed under, phrases are plain words backed by at least two questions, no numbers or dashes; with `BANK_DATA_DIR=<folder with parts.json and text.json>` it also checks `ms`, whole text and the classifier against the bank's own data). `bank:insights -- --check` covers both files and both indexes.
- **Not done:** "Open in the feed" from an example. The feed only restores a saved position when it first draws, so a jump to one part is not a small change.

## What is counted

A **part** is one lettered part of an exam question: the unit the feed lists and counts, and the number every screen shows (the feed calls it a "question"). A **question** is the numbered question its parts share; the file keeps both (`p` and `q`). A part tagged with two topics counts under each.
