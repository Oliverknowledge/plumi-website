# Edexcel GCSE Geography B

Added 31 October 2026: `/question-bank/edexcel-gcse-geography-b`, every question from Pearson
Edexcel's GCSE (9-1) Geography B (1GB0) Papers 1-3 that Pearson publishes on qualifications.pearson.com:
June 2018, June 2019, November 2020, November 2021 and June 2022 to June 2025. That is 721 parts
from 24 papers, every one with its own mark scheme crop and tagged to a key idea, and 666 with
the examiner's comments on its question.

- **Topics:** the specification's nine topics as tiles ("Topic 1: Hazardous Earth" … "Topic 9:
  Consuming energy resources") and their numbered key ideas under them ("1.4 Tropical cyclones
  are caused by particular meteorological conditions"). Topic 6, fieldwork, has no numbered key
  ideas: its four contexts (coasts, rivers, urban, rural) are its topics, coded 6.1-6.4 in the
  data and shown without a code. No AS split, so no year filter (`spec_gcse_geography.py`).
- **Choices:** Paper 2's Section C1 is Question 8 or 9 (coasts or rivers fieldwork), C2 Question 10
  or 11 (urban or rural); June 2022's shortened Paper 1 was Section A and then Section B or C. As in
  the A-Level bank no part is marked `or`; `check_gcse_geography.py` checks every question's parts
  against its printed total (SPaG included) and every section and paper total with the choices,
  and that every part's scheme crop opens on its own row: all 24 papers pass.
- **Figures:** Papers 1 and 2 print their figures in the paper, so a part's crop has them (and
  "Show question 2 so far" brings back a figure printed with an earlier part). Paper 3 is set on a
  Resource Booklet bound in after the paper: each question carries its section of the booklet as
  its stem ("Use Section B (page 5 and page 6) in the Resource Booklet"), and the 12-mark decision
  question (Question 4, "Use information from the Resource Booklet…") the whole booklet, about
  eleven pages, scaled to the 16,000px limit. Its id ends `-q` (`1gb003-jun24-04-q`).
- **Schemes:** read by `cut_pearson.py --extracts --figures` (unchanged) through
  `cut_gcse_geography.py`, which rewrites Geography B's label column first: from June 2023 Sections
  B and C set their labels in a narrower column ("2a" with "(i)" under it); some rows drop the
  question number ("b", "d (i)", "f  Award one mark…"); June 2024 Paper 1 prints a chart whose axis
  ("8 7 6 … 0") ran down the label column. Every 8- and 12-mark crop runs on to its levels grid and,
  where the question has SPaG, the SPaG grid (up to four pages). November 2020 Paper 3 prints 3(d)'s
  "Level 3" row under 3(e)(i)'s table on the next page: it is moved back to 3(d). November 2020
  Paper 2 prints "7 (a)" on a one-part question its scheme calls "7" (`labels/1gb002-nov20.json`).
  June 2018 Paper 2's Figure 7 legend has a column of bracketed counts, "(57)", "(54)": not marks.
- **Reports:** June 2024's three reports set their text in fonts with no character map, so they
  are read by OCR (`ocr.swift`, candidates' scripts whited out first), as Politics' are.
- **Tags:** Claude subagents tagged every part following `tag.md`'s "Edexcel GCSE Geography B"
  section. A question's topic is fixed by paper and number (`tag_gcse_geography.py` rejects
  anything else), so a student who skipped the coasts fieldwork never meets it under rivers.
- **Gaps:** June 2026 is for teachers only. Pearson's November 2020 Paper 2 report and much of
  November 2021 Paper 2's are written by section, not by question, so 55 parts have no comments.
  The specimen papers are left out, as for the other banks. There's no past paper library page
  for Geography B yet, so the credit links to `/past-papers`; the whole papers are on R2 under
  `edexcel/1gb0-*` for the bank's "whole paper" links. Topic 5.8 (the changing rural area) has no
  questions yet, and Paper 3's energy sections sometimes ask about an economy or climate change
  rather than energy itself, so those parts take the nearest Topic 9 key idea.

```bash
python3 scripts/question-bank/edexcel_gcse_geography/fetch_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/spec_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/cut_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/check_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/tag_gcse_geography.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_gcse_geography/tag_gcse_geography.py merge
python3 scripts/question-bank/edexcel_gcse_geography/build_gcse_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-geography --pdf-prefix=edexcel/
```
