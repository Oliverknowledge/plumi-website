# AQA A-Level Economics

Added 26 October 2026, after a student asked for it: `/question-bank/aqa-a-level-economics`,
every question from AQA's A-Level (7136, Papers 1–3) and AS (7135, Papers 1–2) Economics
papers that AQA still publishes, November 2020 to June 2025. That is 686 questions from 28
papers, every one with its mark scheme cropped or its multiple-choice answer, and 274 with
the examiner's comments.

- **Whole questions, grouped by choice.** AQA numbers whole questions (`04`), so each is
  one crop, ending at its marks (the answer book's lines and pages are left out). The
  papers are choices: A-Level Papers 1 and 2 are EITHER Context 1 (01–04) OR Context 2
  (05–08), then one essay of three (09–10, 11–12, 13–14); AS Papers 1 and 2 are 20
  multiple-choice questions, then EITHER Context 1 (21–26) OR Context 2 (27–32); Paper 3
  is 30 multiple-choice questions and an investigation (31–33). A question's id names
  its group (`71361-jun24-c1-04`, `-e2-11`, `-a-05`, `-b-31`), and the group's stem is
  shared: a context's extracts (from the insert, for AS), an essay's opening passage,
  or the investigation's scenario and the insert's extracts. The site finds the stem by
  dropping the id's last part, so "Show how question 04 starts" opens Context 1's
  extracts, and a downloaded set prints each stem once, above the first question that
  uses it (`questionSetPdf.ts` now skips a stem it has already drawn, by image).
- **Either/or.** Context 2's questions and Essays 2 and 3 carry `or`, so a paper's marks
  count one context and one essay, as a candidate answers it: every paper adds up to its
  80 (A-Level) or 70 (AS) marks. The stems begin with "Context 2", "Essay 3", so the
  choice is on the page.
- **Mark schemes:** each question's guidance, from its label to "MAXIMUM FOR QUESTION 04".
  Most 15- and 25-mark questions use a levels-of-response grid printed once per section
  ("Use the level mark scheme on page 4"): it is cut once and stacked under each of
  those questions, so no essay scheme is shown without its levels. (AQA's page
  references are sometimes a page out; the grid is matched by its marks.) Paper 3 and
  the 9- and 10-mark questions print their own grid. Multiple-choice answers are read
  from the scheme's KEY LIST (`k`); November 2021 Paper 3 question 20 accepts "A or C".
- **Topics:** the specification's numbered A-Level topics as tiles ("4.1.5 Perfect
  competition, imperfectly competitive markets and monopoly") and their sub-topics under
  them ("4.1.5.7 Price discrimination"); a sub-topic the AS content also has is Year 1 ·
  AS (`aqa_economics/spec_economics.py`). AS questions are tagged with AS sub-topics only.
- **Pipeline:** `scripts/question-bank/aqa_economics/`: `fetch_economics.py` (fetch_aqa.py
  over 7135/7136, inserts included), `spec_economics.py`, `cut_economics.py` (its own
  layout around cut.py's label finder and image helpers; cut.py is unchanged),
  `tag_economics.py` (tag_pearson.py, briefed by tag.md's AQA Economics section) and
  `build_economics.py`. Papers are on R2 under `aqa/`, crops under `bank/71351*`–`bank/71363*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (its file store has none of them), and
  sat no AS papers in November 2021, so the bank starts at November 2020. The specimen
  papers are left out, as for the other AQA banks. AQA published no reports for November
  2021, AS November 2020 or Paper 3 June 2024, and its Paper 3 reports comment on a few
  multiple-choice questions only. Some extracts are withheld for copyright in AQA's own
  copies: June 2022 Paper 2's Figures 3 and 4, June 2023 Paper 3's Figure 6 and November
  2020 Paper 3's Figure 4. There's no past paper library page for AQA Economics yet, so
  the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_economics/fetch_economics.py
python3 scripts/question-bank/aqa_economics/spec_economics.py
python3 scripts/question-bank/aqa_economics/cut_economics.py
python3 scripts/question-bank/aqa_economics/tag_economics.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_economics/tag_economics.py merge
python3 scripts/question-bank/aqa_economics/build_economics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-economics
```
