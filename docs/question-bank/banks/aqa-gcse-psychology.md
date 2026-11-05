# AQA GCSE Psychology

Added 2 November 2026: `/question-bank/aqa-gcse-psychology`, every question from AQA's GCSE
Psychology (8182) Paper 1 (Cognition and behaviour) and Paper 2 (Social context and
behaviour) that AQA still publishes, November 2020 to June 2025. That is 375 questions and
parts from 12 papers (100 marks each), every one tagged to a topic; 61 multiple-choice
questions with their answer letters ("B", or "C and E" for "Shade two boxes"), the other 314
with their mark scheme cropped, and 153 questions with the examiner's comments (AQA published
no report for November 2020 or November 2021).

- **Questions.** The A-Level Psychology cutter (`aqa_psychology/cut_psychology.py`, so
  `cut.py`): questions are numbered through the paper ("0 5"), with parts ("0 4 . 2") only
  under a stimulus ("Read the following information."), which is their stem (142 parts, 41
  stems). Two GCSE fixes, made from `cut_gcse_psychology.py` without changing either file:
  a multiple-choice question keeps all its options (`cut.py`'s `move_setups` took option B, a
  full sentence after the marks, for the next part's setup); Paper 2's Section B heading
  ("Language, thought and communication / Answer all questions…") is cut off the question
  under it. Question 1 starts at its label, below the paper's multiple-choice instructions.
- **Mark schemes:** each question reprints itself in a box under its label, then its guidance,
  and for an extended answer the whole levels grid and the possible content, up to the next
  label, across pages. Scheme labels are read bold only and kept only where the question paper
  has them: answers at the margin ("81.6", "28", "19.075") had ended schemes early. The frame
  runs to the footer rule and 565pt across (the A-Level's stopped at 766pt and 541pt, cutting
  a grid's last row and the ends of wide lines), and a scheme ends on the next question's box
  rule. The cutter checks every 9-mark scheme, and any other with a levels grid, for the whole
  grid and its content. Most 6-mark "design a study" questions are marked point by point.
- **Checks:** `check_gcse_psychology.py` re-reads every crop's pieces and lists any edge that
  runs through a line of text, a question 1 with front matter, a section heading in a
  question, a multiple-choice question missing an option, and a label read twice. It lists
  none.
- **Reports:** "Question 4.1: …" in prose (read by sentence, as the A-Level's Paper 3), or "Q3.1"
  headings (Paper 2, June 2024); kept by question.
- **Topics:** the specification's eight areas as tiles (3.1.1 Memory to 3.2.4 Psychological
  problems) and the 49 rows of their Content columns as topics (`3.1.2.4 Visual illusions`).
  Any question may take any topic: research methods is examined in both papers and each
  synoptic 9-mark question draws on the other paper. 3.1.3.3 (Piaget's theory in education)
  has no question yet.
- **Pipeline:** `scripts/question-bank/aqa_gcse_psychology/`: `fetch_gcse_psychology.py`
  (`fetch_aqa.py` over 8182), `spec_gcse_psychology.py`, `cut_gcse_psychology.py`,
  `check_gcse_psychology.py`, `tag_gcse_psychology.py` (briefed by tag.md's AQA GCSE
  Psychology section) and `build_gcse_psychology.py`. Papers are on R2 under `aqa/AQA-8182*`,
  crops under `bank/8182*`.
- **Gaps:** June 2019, the first sitting, is no longer on AQA's site (its file store redirects),
  so the bank starts at November 2020. The specimen papers are left out, as for the other AQA
  banks. No library page (`/past-papers`) yet.

```bash
python3 scripts/question-bank/aqa_gcse_psychology/fetch_gcse_psychology.py
python3 scripts/question-bank/aqa_gcse_psychology/spec_gcse_psychology.py
python3 scripts/question-bank/aqa_gcse_psychology/cut_gcse_psychology.py
python3 scripts/question-bank/aqa_gcse_psychology/check_gcse_psychology.py
python3 scripts/question-bank/aqa_gcse_psychology/tag_gcse_psychology.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_psychology/tag_gcse_psychology.py merge
python3 scripts/question-bank/aqa_gcse_psychology/build_gcse_psychology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-psychology
```
