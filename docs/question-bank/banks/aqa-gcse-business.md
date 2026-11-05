# AQA GCSE Business

Added 1 November 2026: `/question-bank/aqa-gcse-business`, every question from AQA's GCSE
Business (8132) Papers 1 and 2 that AQA still publishes, November 2020 to June 2025. That is
312 parts from 12 papers (156 a paper), every one tagged to a topic; 72 multiple-choice parts
with their answer letter, the other 240 with their mark scheme cropped, and 24 questions with
the examiner's comments (no report is published for November 2021 or June 2024).

- **Parts.** The GCSE Geography cutter's part finder (`cut_geography.py`'s `qp_parts`, with
  `cut_gcse_geography.py`'s GCSE label reading): a part is any table or figure printed above
  its label ("Table 1 Extract from a cash flow forecast", Paper 2's Boston Matrix), then its
  words to its marks, and a multiple-choice part's options. The answer space's prompts
  ("Workings", "Answer %", "Method 2") end a part and lead nothing.
- **Items.** Sections B and C are questions 02 and 03, each set on one business told in
  items (Item A, B; Item C, D, E) printed through the question, before the parts that use them.
  A question's stem (`81321-jun24-02-stem.webp`) is all of its items in order, whether one opens
  the question, sits above a part or has a "0 2" label of its own (Paper 2, June 2022), so
  every part shows with the items it is set on and no part's crop repeats one. The cutter
  checks that every item a part names ("Using Item D") is in its stem.
- **Mark schemes:** each part runs from its label ("2.3") to the next part's label or section
  heading, across pages, so a 9- or 12-mark scheme comes with its levels grid and all of its
  indicative content (the cutter checks both). Multiple-choice letters come from Section A's
  answer table.
- **Reports:** headed by part ("Question 2.3", "2.3"), and Section A's multiple choice
  together ("Questions 1.1 – 1.6"); kept by question. November 2020 comments on whole sections:
  each section's comments are its question's report.
- **Topics:** the specification's six areas as tiles and its 29 numbered topics (`3.6.2 Cash
  flow`). Paper 1 parts take 3.1 to 3.4, Paper 2 parts 3.1, 3.2, 3.5 and 3.6
  (`tag_gcse_business.py merge` rejects anything else).
- **Pipeline:** `scripts/question-bank/aqa_gcse_business/`: `fetch_gcse_business.py`
  (`fetch_aqa.py` over 8132), `spec_gcse_business.py`, `cut_gcse_business.py` (the GCSE
  Geography part finder and `cut_business.py`'s report reader; neither is changed),
  `tag_gcse_business.py` (briefed by tag.md's AQA GCSE Business section) and
  `build_gcse_business.py`. Papers are on R2 under `aqa/AQA-8132*`, crops under `bank/8132*`.
- **Gaps:** AQA no longer publishes June 2018 or June 2019 (its file store redirects), so the
  bank starts at November 2020. The specimen papers are left out, as for the other AQA banks.
  AQA's modified copies (A3, 18pt) are not used. No library page (`/past-papers`) yet.

```bash
python3 scripts/question-bank/aqa_gcse_business/fetch_gcse_business.py
python3 scripts/question-bank/aqa_gcse_business/spec_gcse_business.py
python3 scripts/question-bank/aqa_gcse_business/cut_gcse_business.py
python3 scripts/question-bank/aqa_gcse_business/tag_gcse_business.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_business/tag_gcse_business.py merge
python3 scripts/question-bank/aqa_gcse_business/build_gcse_business.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-business
```
