# AQA Level 2 Further Maths

Added 1 November 2026: `/question-bank/aqa-level-2-further-maths`, every question from AQA's
Level 2 Certificate in Further Mathematics (8365), the qualification many schools sit beside
GCSE Maths. Its `level` is "Level 2", so its pages say "AQA Level 2 Further Maths", not GCSE;
the hub shelves it on the GCSE shelf as a Further Maths book, and its whole-paper link goes to
the library's AQA GCSE Maths page, where 8365 has its own group.

| Papers | Series | Questions | Scheme crops | Reports |
| --- | --- | --- | --- | --- |
| 1 (non-calculator), 2 (calculator) | November 2021, June 2022 to June 2025, and the specimen papers (6) | 259 | 259 | 164 |

Every paper's questions add up to its 80 marks.

- **Sources, AQA's own site.** The certificate's resources page
  (aqa.org.uk/subjects/mathematics/aqa-certificate/mathematics-8365) lists November 2021 (the
  autumn series that stood in for June 2021) and June 2022 to June 2025, with the specimens.
  June 2019 and earlier aren't public (AQA's file store doesn't serve them), so the bank starts
  in 2021. The PDFs are the past paper library's copies already on R2 under `aqa/`; only the
  crops went up (`bank/8365*`). No November 2021 reports were published.
- **Cut** by `gcse_maths/cut_aqa_gcse_maths.py` (whole questions, the room to work in closed
  up), through `aqa_l2_further_maths/cut_l2fm.py`, which changes two things. The scheme's Q
  column is narrower in some years (x 84 in June 2025 Paper 1, against 8300's 92-99), so the
  rule over a label's cell is any reaching past x 80 (`Q_COLUMN_END`, 90 for GCSE). And a
  question starts at the top of the ink on its label's line, not the label: matrices, column
  vectors and stacked fractions open many 8365 questions and stand taller than the label, and
  138 of the 259 crops had lost their top row to the question before. `cut_maths.py`'s other
  users (AQA GCSE and A-Level Maths) start at the label too, so they likely clip the same way.
- **Schemes checked whole:** every question has its rows; no crop holds another question's
  label; and the M, A and B marks in each crop's Mark column add up to at least the question's
  marks, bar eight where the column moves between pages or a row is only guidance, each looked
  at by eye.
- **Topics** are the specification's 57 statements, 1.1 to 6.10, under its six areas (Number,
  Algebra, Coordinate geometry, Calculus, Matrix transformations, Geometry and trigonometry),
  with short names of ours (`spec_l2fm.py`); tagged a whole question at a time, one to three
  codes (tag.md's Level 2 Further Maths section). 4.1 (the gradient function) has no question
  of its own, so it has no page.
