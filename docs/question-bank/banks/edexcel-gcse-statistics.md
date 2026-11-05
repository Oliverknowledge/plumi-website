# Edexcel GCSE Statistics

Added 5 November 2026 after a member asked for it on iPad and web: `/question-bank/edexcel-gcse-statistics`,
every question from Pearson Edexcel's GCSE (9-1) Statistics (1ST0) Papers 1 and 2, Foundation and Higher, that
Pearson publishes on qualifications.pearson.com: June 2019 (the first exam), November 2020, November 2021 and June
2022 to June 2025. That is 358 questions from 28 papers (Paper 1 Higher 83, Paper 1 Foundation 94, Paper 2 Higher
84, Paper 2 Foundation 97), 2,240 marks, every one with its own mark scheme crop and its examiner's report. Every
paper's questions add up to its 80 marks, numbered 1 to N with none missing.

- **Layout, not a new board:** 1ST0's papers are laid out as 1MA1's (Pearson's GCSE house style: bold question
  numbers, "(Total for Question 3 is 6 marks)", answer lines, schemes of "Question number | Answer | Additional
  guidance"), so this is the GCSE Maths Pearson cutter (`gcse_maths/cut_pearson_gcse_maths.py`, on
  `cut_pearson.py --whole`) through `edexcel_gcse_statistics/cut_gcse_statistics.py`: a whole question at a time
  with all its scheme rows, because a later part builds on an earlier one and on the tables and graphs printed
  with it. The room left to work in is closed up. Reports are keyed by question (`reportsBy`).
- **What 1ST0 needed besides** (all patched in `cut_gcse_statistics.py`, `cut_pearson.py` is unchanged):
  - four schemes (June 2024 Paper 1H, November 2020's 1H, 2F and 2H) head their tables "Question number", not
    "Question Number": the reader found no label on those pages and left 23 questions with no scheme;
  - a number set in from the label column is working, not a label: the 4 of "⁴C₃ × (0.6)³" on a page with no header
    of its own read as Question 4 and took June 2024 1H's 9(b) with it;
  - a row run over a page is headed "7 (c)" with "cont." under it (June 2019 and November 2020): left as a label
    it was a second row for 7(c), which the reader drops, so 7(c)'s continuation was lost. The label is removed and
    the continuation runs on from the row above.
- **Check:** `check_gcse_statistics.py` checks every paper's marks against its cover's 80, that the questions run 1
  to N, that each has its paper crop, scheme and report, that every scheme page from the first table to the last row
  is in some question's scheme, and that no crop ends on the next question's table header: all 28 pass. The sheets
  were read by eye: tables, histograms, maps, tree diagrams, scatter graphs, box plots and the multi-page schemes
  (the checks above were each found by looking, not by the numbers).
- **Topics:** the specification's content, 15 topics in three areas: 1 The collection of data (1a Planning, 1b
  Types of data, 1c Population and sampling, 1d Collecting data), 2 Processing, representing and analysing data (2a
  Tabulation, diagrams and representation to 2h Estimation) and 3 Probability. The specification prints probability
  as one group ("3p.01" to "3p.13"); `spec_gcse_statistics.py` splits it by statement into 3a (estimating and
  comparing probabilities), 3b (combined events and conditional probability) and 3c (binomial and normal
  distributions) so that its page isn't a third of the bank. Read from the Higher tier content, which prints every
  statement; Foundation and Higher papers take the same codes. Tagged by Claude subagents (six batches of 60) per
  `tag/edexcel-gcse-statistics.md`, one to three topics a question, the main one first. The taggers worked from the
  question's words, the scheme's and, for some, its crop (the brief says to read the crop for a table or a graph):
  a handful of mixed-topic questions could be argued either way, and the question text each saw was cut at 1,200
  characters.
- **Both tiers:** 41 of the 191 Foundation questions are on the Higher paper too (`tiers.json`, from `tiers.py`).
  `tiers.py` now compares Statistics as it does Maths (numbers kept in, any order), as a Statistics question's data
  is what tells two questions of one kind apart. Every pair is the same question: 32 differ in under 1% of
  their pixels and the other nine (the same words and figures, set with different spacing) were checked by eye.
- **No calculator filter** (`noCalc`): every 1ST0 paper allows a scientific calculator.
- **Sources:** Pearson's own site only (its past paper search, `gcse17-stat`): 84 files (every paper, scheme and
  report of the seven series), all on R2 under `edexcel/1st0-<paper>-<kind>-<series>.pdf` for the bank's "whole
  paper" links. No mirror was used. There is no past paper library page for GCSE Statistics yet.

Gaps, honestly:
- June 2026's papers, schemes and reports are listed by Pearson but for teachers only (12 files). Add the series
  when they are public.
- Pearson's specimen and sample assessment materials are left out, as for the other banks.
- Foundation and Higher papers share 41 questions, so those appear twice unless the "show once" switch is on.
- The 1ST0 papers print no case study or source booklet; nothing is carried in a question's stem.

```bash
pip install pymupdf pillow boto3
python3 scripts/question-bank/edexcel_gcse_statistics/fetch_gcse_statistics.py
python3 scripts/question-bank/edexcel_gcse_statistics/spec_gcse_statistics.py
python3 scripts/question-bank/edexcel_gcse_statistics/cut_gcse_statistics.py
python3 scripts/question-bank/edexcel_gcse_statistics/check_gcse_statistics.py
python3 scripts/question-bank/edexcel_gcse_statistics/tag_gcse_statistics.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_gcse_statistics/tag_gcse_statistics.py merge
python3 scripts/question-bank/edexcel_gcse_statistics/build_gcse_statistics.py
python3 scripts/question-bank/tiers.py edexcel-gcse-statistics
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-statistics --pdf-prefix=edexcel/
npm run bank:data -- edexcel-gcse-statistics --verify
```
