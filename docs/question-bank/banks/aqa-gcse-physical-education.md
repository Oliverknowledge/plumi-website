# AQA GCSE Physical Education

Added 3 November 2026: `/question-bank/aqa-gcse-physical-education`, every question from AQA's GCSE
Physical Education (8582) Paper 1 (The human body and movement in physical activity and sport) and
Paper 2 (Socio-cultural influences and well-being in physical activity and sport) that AQA publishes:
November 2020, November 2021 and June 2022 to June 2025. That is 357 questions and parts from 12
papers, every paper adding up to its 78 marks, every one tagged.

- **Questions and parts.** Each paper opens with five to seven multiple-choice questions, then
  short questions numbered through the paper ("0 7"), parts ("0 7 . 1") under a shared figure or
  scenario, which is the parts' stem (81 parts), and closes with a 6-mark and a 9-mark answer.
  Two parts ask about a figure or table printed only on the part before (November 2020 Paper 1's
  10.5, June 2022 Paper 2's 13.2): each carries a copy, so it can be read on its own.
- **Mark schemes:** each question's guidance under its reprinted question, cut from its label to the
  next, so a levels scheme brings its whole grid and its possible content across pages (293 crops).
  The 64 multiple-choice questions carry their letter (`k`) instead of a crop, each checked against
  the option's words in the paper. The closing grid of marks by assessment objective is left out.
- **Examiner's reports:** June 2022 to June 2025, kept per part under their "QUESTION 6.1" headings
  (238 parts). A comment on the multiple choice as a whole goes to each of those questions. AQA
  published none for November 2020 and 2021.
- **Topics:** the specification's seven areas as tiles (Applied anatomy and physiology, Movement
  analysis, Physical training, Use of data on Paper 1; Sports psychology, Socio-cultural influences,
  Health, fitness and wellbeing on Paper 2) and their 25 numbered topics under them
  (`3.1.3.2` Components of fitness and how they are measured). A part marked for reading or drawing
  data takes `3.1.4.x` on either paper (tag.md's AQA GCSE Physical Education section).
- **Pipeline:** `scripts/question-bank/aqa_gcse_pe/`: `fetch_gcse_pe.py` (`fetch_aqa.py` over 8582),
  `spec_gcse_pe.py`, `cut_gcse_pe.py` (A-Level PE's cutter with GCSE PE's frame, closing grid, report
  headings and 78 marks), `check_gcse_pe.py`, `tag_gcse_pe.py` and `build_gcse_pe.py`. No shared
  script changed. Papers are on R2 under `aqa/AQA-8582*`, crops under `bank/8582*`.
- **Gaps:** AQA no longer publishes the first sittings, June 2018 and June 2019, on its site or file
  store, so the bank starts at November 2020. Only AQA's own site is used. The specimen papers and the
  practical NEA are left out. No PE past-paper library page exists, so the bank has no library link.

```bash
python3 scripts/question-bank/aqa_gcse_pe/fetch_gcse_pe.py
python3 scripts/question-bank/aqa_gcse_pe/spec_gcse_pe.py
python3 scripts/question-bank/aqa_gcse_pe/cut_gcse_pe.py
python3 scripts/question-bank/aqa_gcse_pe/check_gcse_pe.py
python3 scripts/question-bank/aqa_gcse_pe/tag_gcse_pe.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_pe/tag_gcse_pe.py merge && python3 scripts/question-bank/aqa_gcse_pe/build_gcse_pe.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-pe --checksum
```
