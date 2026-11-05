# AQA A-Level Sociology

Added 27 October 2026: `/question-bank/aqa-a-level-sociology`, every question from AQA's
A-Level (7192, Papers 1–3) and AS (7191, Papers 1–2) Sociology papers that AQA still
publishes, November 2020 to June 2025. That is 356 questions from 28 papers, every one
with its mark scheme cropped and tagged to a topic, 286 with the examiner's comments.

- **Whole questions, each Item its stem.** AQA numbers whole questions (`05`), so each is
  one crop, from its label to its marks (the answer lines are left out). The longer
  questions are set on an Item, a boxed passage printed between "Read Item C below…" and
  the question's own words: the box is cut out as the question's stem, and the question's
  crop is its label line stacked on its own words. Each Item serves one question, so the
  id names the Item (`71922-jun24-ic-05`, stem `71922-jun24-ic-stem.webp`); a question
  without one names its option or `q` (`71922-jun24-a2-04`, `71921-jun24-q-01`).
- **Options.** A-Level Paper 2 is Topics A1–A4 (Culture and Identity, Families and
  Households, Health, Work, Poverty and Welfare), one answered, then Topics B1–B4 (Beliefs
  in Society, Global Development, The Media, Stratification and Differentiation), one
  answered. AS Paper 2 is research methods (Section A) and one of four topics (B1–B4, the
  A-Level's A1–A4). Topics A2–A4 and B2–B4 carry `or`, so each paper's marks count one
  topic per section: every paper adds up to its 80 (A-Level) or 60 (AS) marks. Papers 1
  and 3 have no options. `QuestionRow` used to hide the marks of a question that is itself
  an alternative (no part in its row to be the alternative to); it now hides them only
  when the row holds both, which also puts the marks back on AQA Economics' Context 2.
- **Mark schemes:** one table per question ("Qu | Marking guidance | Total marks"), cut
  from its heading to the next question's, so the Item, the whole levels-of-response grid,
  the indicative content and the sources come with it. The cutter checks every 10-mark
  or longer scheme has its levels.
- **Topics:** the specification's areas as tiles (`4.1.1 Education` … `4.3.1 Crime and
  Deviance`; Theory and Methods, which Papers 1 and 3 share, is one area with Methods in
  Context in it), and each area's bullet points as its topics. The specification doesn't
  number its bullets, so the codes number them in order (`4.2.2.4`) and are not shown:
  a topic shows its short name ("Childhood and the status of children",
  `aqa_sociology/spec_sociology.py`). An option question is always tagged to its option.
- **Pipeline:** `scripts/question-bank/aqa_sociology/`: `fetch_sociology.py` (fetch_aqa.py
  over 7191/7192), `spec_sociology.py`, `cut_sociology.py` (its own layout around cut.py's
  label finder and image helpers; cut.py is unchanged), `tag_sociology.py` (briefed by
  tag.md's AQA Sociology section; merge rejects a first tag outside the question's area)
  and `build_sociology.py`. Papers are on R2 under `aqa/`, crops under `bank/7191*`, `bank/7192*`.
- **Gaps:** AQA no longer publishes June 2017–2019, and sat no AS papers in November 2021,
  so the bank starts at November 2020. The specimen papers are left out, as for the other
  AQA banks. AQA published no reports for AS November 2020 or Paper 1 June 2025, and its
  November 2020 and 2021 Paper 2 reports cover only Families and Households and Beliefs in
  Society (6 of 24 questions). There's no past paper library page for AQA Sociology yet,
  so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_sociology/fetch_sociology.py
python3 scripts/question-bank/aqa_sociology/spec_sociology.py
python3 scripts/question-bank/aqa_sociology/cut_sociology.py
python3 scripts/question-bank/aqa_sociology/tag_sociology.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_sociology/tag_sociology.py merge
python3 scripts/question-bank/aqa_sociology/build_sociology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-sociology
```
