# Edexcel GCSE Business

Added 1 November 2026: `/question-bank/edexcel-gcse-business`, every question from Pearson Edexcel's
GCSE (9-1) Business (1BS0) Papers 1 and 2 that Pearson publishes on qualifications.pearson.com:
June 2019 (the first exam), November 2020, November 2021 and June 2022 to June 2025. That is 377
parts from 14 papers, every one with its own mark scheme crop, tagged to a sub-topic and with the
examiner's comments on its question; 36 single-answer multiple-choice parts carry their answer.

- **Topics:** the specification's ten topics as tiles ("Topic 1.3 Putting a business idea into
  practice") and their 38 numbered sub-topics under them ("1.3.2 Business revenues, costs and
  profits"). Paper 1 tests Theme 1 and Paper 2 Theme 2, so a part's first tag is from its paper's
  theme (`tag_gcse_business.py` rejects anything else). No AS split, so no year filter.
- **Case studies:** Sections B and C are set on a case study, one for Questions 4 to 6 and one for
  Question 7. Every part of those questions carries its case study in its stem, not only the first
  question after it: to June 2022 the extract is printed in the paper ("Read the following extract
  before answering Questions 4, 5 and 6."), from June 2023 it is the Source Booklet's "SECTION B" or
  "SECTION C" block. A question's own lines (Question 5's "Table 2 shows…") go under the case study.
- **Premises:** a part's setup printed above its label ("…is considering two options: Option 1…
  Option 2…" over "(c) Justify which one…", "Table 1 contains information…" over a calculation) is
  cropped with that part, not left at the foot of the part before.
- **Schemes:** read by `cut_pearson.py --extracts` (unchanged) through `cut_gcse_business.py`. Every
  6, 9 and 12-mark crop has its indicative content and one whole levels grid, Level 1 to Level 3,
  including the 12-mark answers that run over a page; `check_gcse_business.py` checks that, and
  that every paper's parts add up to 90: all 14 pass. A "Section B" heading between two tables is
  not part of the row above it. Two-answer multiple choice ("Select two answers") has no answer
  key, so its scheme crop shows instead.
- **Gaps:** June 2026 is for teachers only. June 2025 Paper 2's Question 1(b) was printed wrongly
  ("earliest" for "latest", Pearson's clarification notice bound in front of the paper), so it is
  left out. The sample assessment materials are left out, as for the other banks. There's no past
  paper library page for GCSE Business yet; the whole papers are on R2 under `edexcel/1bs0-*` for
  the bank's "whole paper" links.

```bash
python3 scripts/question-bank/edexcel_gcse_business/fetch_gcse_business.py
python3 scripts/question-bank/edexcel_gcse_business/spec_gcse_business.py
python3 scripts/question-bank/edexcel_gcse_business/cut_gcse_business.py
python3 scripts/question-bank/edexcel_gcse_business/check_gcse_business.py
python3 scripts/question-bank/edexcel_gcse_business/tag_gcse_business.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_gcse_business/tag_gcse_business.py merge
python3 scripts/question-bank/edexcel_gcse_business/build_gcse_business.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-business --pdf-prefix=edexcel/
```
