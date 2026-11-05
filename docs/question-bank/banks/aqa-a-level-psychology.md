# AQA A-Level Psychology

Added 25 October 2026, after a student asked for it: `/question-bank/aqa-a-level-psychology`,
every question from AQA's A-Level (7182, Papers 1–3) and AS (7181, Papers 1–2)
Psychology papers that AQA still publishes, November 2020 to June 2025. That is 669
questions from 27 papers, every one with its mark scheme cropped (for an essay, the
whole levels table and the possible content) and 498 with the examiner's comments.

- **Topics:** the specification's A-Level topics, arranged as the papers are: Paper 1's
  four, Paper 2's Approaches, Biopsychology and Research methods (split into its four:
  methods, scientific processes, data handling and analysis, inferential testing),
  Issues and debates, and the nine Paper 3 options in three tiles ("Paper 3 options").
  A Paper 3 option question always carries its option's topic.
- **Pipeline:** `scripts/question-bank/aqa_psychology/`, the AQA scripts with
  Psychology's differences: `fetch_psychology.py` (fetch_aqa.py over 7181/7182),
  `spec_psychology.py`, `cut_psychology.py` (cut.py, with mark schemes read as text
  rather than tables, section headings left out, and a question's scenario or table
  moved down to it when it is printed above its label), `tag_psychology.py` (briefed
  by tag.md's AQA Psychology section) and `build_psychology.py`. Papers are on R2
  under `aqa/`, crops under `bank/`.
- **Gaps:** AQA no longer publishes June 2017–2019, so the bank starts at November
  2020. AS Paper 2 June 2025's question paper isn't published (its scheme is). The
  specimen papers are left out (cut.py can't read their labels). The November 2020
  and 2021 Paper 3 reports don't comment question by question, AQA published no
  November 2020 AS reports, and some reports discuss only selected questions, so
  171 questions have no examiner's report. There is no past paper
  library page for Psychology yet, so the bank's "whole papers" credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_psychology/fetch_psychology.py
python3 scripts/question-bank/aqa_psychology/spec_psychology.py
python3 scripts/question-bank/aqa_psychology/cut_psychology.py
python3 scripts/question-bank/aqa_psychology/tag_psychology.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_psychology/tag_psychology.py merge
python3 scripts/question-bank/aqa_psychology/build_psychology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-psychology
```
