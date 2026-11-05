# AQA A-Level History

Added 1 November 2026: `/question-bank/aqa-a-level-history`, every question from AQA's
A-Level History (7042) Component 1 (breadth, options 1A to 1L) and Component 2 (depth,
options 2A to 2T) papers that AQA still publishes, November 2020 to June 2025. That is 684
questions from 171 papers across all 30 options, every one with its mark scheme cropped
whole (the target, the levels grid and all the indicative content, across pages) and 392
with the examiner's comments. Every paper's marks are as set: Question 01 is worth 30 and
Questions 02 to 04 are worth 25 each (a student answers two, for the paper's 80).

- **Options.** Each option is its own paper (70421H is Component 1H, Tsarist and Communist
  Russia), so every paper and section carries its `option` and the bank's Option filter
  (the RS and English Literature mechanism, single-select) keeps one option's questions and
  periods. A student studies one Component 1 and one Component 2 option: they pick either,
  or both papers in the Paper filter. Component 3 is the NEA, so it has no questions.
- **Question 01's extracts or sources.** Component 1's Question 01 is set on three
  extracts (interpretations), Component 2's on three sources. They are cut as its stem
  (`70421h-jun23-01-stem.webp`), from the top of Extract A's or Source A's box to the
  label, shown above the question and searched with it. Ids end `-q`
  (`70421h-jun23-01-q`), as Eduqas GCSE History's do, so `partImage` finds the stem.
  Where AQA's copy of a paper ("-CR") leaves an extract out for copyright, the stem shows
  AQA's note with the book it came from: 72 extracts or sources in 44 papers (33 in
  Component 1, 39 in Component 2).
- **Topics:** each option's periods from the specification (`spec_history.py`), 158 in
  30 sections (4 per breadth option, 6 per depth option), "(A-level only)" dropped. The
  specification misprints 1C's first period as "Henry VIII, 1485–1509"; it is Henry VII.
  Tagging is by rule, with no tagging pass (`tag_history.py`): a question that names its
  years ("in the years 1855 to 1881") goes to the periods of its own option they overlap,
  and one that doesn't (most Question 01s) by the years its question, sources and scheme
  mention, or by its words. Periods with the same dates (1B's Golden Age and Great Power)
  are split by words. Every question is tagged and every period has questions.
- **Pipeline:** `scripts/question-bank/aqa_history/`: `fetch_history.py` (fetch_aqa.py over
  7042), `spec_history.py`, `cut_history.py` (cut_philosophy.py, whose layout History
  shares, with the frame widened to the marks at 542pt, Question 01's stem, a step past a
  lone bullet over "Section B" in one scheme, and its own report reader for the many ways
  History's reports head a question: "Question 01", "Q1", "Section A, Q1", "Report on
  Question 2", "Question One", with contents pages and general guidance skipped; cut.py,
  cut_psychology.py and cut_philosophy.py are unchanged), `tag_history.py` and
  `build_history.py`. Papers are on R2 under `aqa/AQA-7042*`, crops under `bank/7042*`.
- **Gaps:** AQA no longer publishes June 2017 to June 2019 (404 on its file store), and the
  AS (7041) is left out. 2C and 2T were not sat in November 2020, nor 1B, 1E, 1F, 2C, 2K,
  2M and 2T in November 2021. AQA published no reports for November 2020 or 2021, none for
  1E, 2C or 2T in any series, and none for 1A to 1D, 1H, 2B, 2E, 2N, 2O and 2S in June
  2025, so 292 questions have no examiner's report.

```bash
python3 scripts/question-bank/aqa_history/fetch_history.py
python3 scripts/question-bank/aqa_history/spec_history.py
python3 scripts/question-bank/aqa_history/cut_history.py
python3 scripts/question-bank/aqa_history/tag_history.py
python3 scripts/question-bank/aqa_history/build_history.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-history
```
