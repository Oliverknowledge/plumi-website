# Edexcel GCSE Combined Science

`/question-bank/edexcel-gcse-combined-science`, added 1 November 2026 so that every GCSE
science route is covered: every question from Pearson Edexcel's GCSE (9–1) Combined Science
(1SC0) papers, Foundation and Higher, June 2018 to June 2025 with November 2020 and 2021.
That is 2,937 question parts from 96 papers, one bank for the three sciences: Biology,
Chemistry and Physics Paper 1 and 2, each in two tiers ("Chemistry Paper 2 Higher"), as in
the AQA Trilogy bank. Every paper's parts add up to its 60 marks, and every part has its
own mark scheme crop. Topics are the specification's, by science: sections B1–B9, C1–C8
(no C5) and P1–P15 (no P7 or P11), 94 sub-topics.

- **Source papers:** Pearson's own site only, from the same search as the separate sciences
  (`gcse16-science`). June 2018 comes as a zip per science and tier, June 2019 as a zip per
  tier; the rest are single PDFs. Whole papers are on R2 under `edexcel/`
  (`1sc0-2ch-qp-jun24.pdf`), crops under `bank/` (`1sc02ch-jun24-…`).
- **Topics:** 1SC0 prints the separate sciences' statements less those for one science
  alone, numbered as theirs. `spec_combined.py` keeps `spec_gcse.py`'s groups to the
  statements 1SC0 prints and drops the empty ones; three are renamed for what's left
  (`TITLES`). Each sub-topic keeps its separate-science code (`separate`).
- **Cutting:** `cut_combined.py` runs `cut_gcse.py`, with patches kept to this bank for how
  1SC0's schemes print their labels (its docstring lists them). Before them, five six-mark
  rows had no crop, a third of the six-mark rows stopped short of their levels grid (its
  "0" or "1" read as a question number) and two dozen calculation rows stopped at a
  fraction's denominator. Now all 96 six-mark rows carry their indicative content and
  levels. Physics 1F June 2019 is a scan: its labels are set by hand
  (`labels/1sc01pf-jun19.json`) from the OCR'd part labels and each question's total.
  Six scheme rows a scheme misnumbers are in `labels/` too.
- **Reports:** 569 of the 576 questions have their examiner's report. Nine of June 2024's
  reports have no usable text layer, so they're read by OCR, leaving out the candidates'
  answers (pictures) and the running header; and three heading styles 1SC0's reports use
  besides "Question 3 (b)" on its own line are read too. Seven questions (Chemistry 1F
  November 2021 and Chemistry 2H November 2020) have no comment of their own.
- **Tags:** 2,847 parts (97%) are also printed on the same sitting's 1BI0, 1CH0 or 1PH0
  paper (same wording and marks, as `tiers.py` matches). `tag_combined.py` gives those the
  separate bank's tags, in this bank's codes. The other 124 were tagged by Claude following
  `tag.md`. The two banks stay apart: neither links to the other.
- **Practicals:** 392 parts, the crossovers' verdicts carried from the separate banks, six
  judged afresh.
- **Both tiers:** 391 Foundation parts are also on the Higher paper (`tiers.json`).

Gaps, honestly:
- June 2026 is for teachers only on Pearson's site.
- The specimen papers aren't in: most of their questions are in the separate sciences'
  specimen books, and the AQA Trilogy bank leaves its specimens out too.
- Physics 1F June 2019's crops are scans and keep the scan's blank answer space.
- Foundation and Higher papers share questions, so those appear twice unless the "Both-tier
  questions once" switch is on.

```bash
python3 scripts/question-bank/edexcel_combined/fetch_combined.py
python3 scripts/question-bank/edexcel_combined/spec_combined.py
python3 scripts/question-bank/edexcel_combined/cut_combined.py      # --only=1sc02ch-jun26 for one paper
python3 scripts/question-bank/edexcel_combined/tag_combined.py split   # tag the batches left, then:
python3 scripts/question-bank/edexcel_combined/tag_combined.py merge
python3 scripts/question-bank/edexcel_combined/build_combined.py
python3 scripts/question-bank/tiers.py edexcel-gcse-combined-science
python3 scripts/question-bank/practicals.py split --only=edexcel-gcse-combined-science --parts=scripts/question-bank/.work/edexcel-combined/parts.json   # judge, then merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-combined --pdf-prefix=edexcel/
```
