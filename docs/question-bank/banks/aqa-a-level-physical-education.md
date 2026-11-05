# AQA A-Level Physical Education

Added 3 November 2026: `/question-bank/aqa-a-level-physical-education`, every question from
AQA's A-Level Physical Education (7582) Paper 1 (Factors affecting participation in physical
activity and sport) and Paper 2 (Factors affecting optimal performance in physical activity and
sport) that AQA publishes: November 2020, November 2021 and June 2022 to June 2025. That is 286
questions from 12 papers, every paper adding up to its 105 marks, every question tagged.

- **Whole questions, parts now and then.** Each paper is three sections, each opening with two
  multiple-choice questions and closing with an 8-mark and a 15-mark extended answer; questions are
  numbered through the paper ("0 7"), with parts ("0 4 . 2") under a shared stimulus, which is the
  parts' stem (29 parts).
- **Mark schemes:** each question's guidance under its reprinted question, cut from its label to the
  next, so an 8- or 15-mark scheme brings its whole levels grid and its possible content, across
  pages (214 crops). The 72 multiple-choice questions carry their letter (`k`) instead of a crop.
  The cutter checks every extended answer's scheme for its whole grid ("0 | No relevant content")
  and its content, and every scheme for a closing line, so none is cut short at a page foot or runs
  into the next question.
- **Examiner's reports:** June 2022 to June 2025 (156 questions). AQA published none for November
  2020 and 2021, and June 2025's skip the multiple-choice questions.
- **Topics:** the specification's seven areas as tiles (Applied anatomy and physiology, Skill
  acquisition, Sport and society on Paper 1; Exercise physiology, Biomechanical movement, Sport
  psychology, Sport, society and technology on Paper 2) and their numbered topics under them,
  with Sport psychology's one five-page heading split into its fourteen (`3.2.3.1.1` Aspects of
  personality … `3.2.3.1.14` Stress management) and the history of sport into its three eras. A
  paper's section fixes its first tag's area (tag.md's AQA PE section); 3.1.1.1, the spec's
  umbrella over the cardiovascular and respiratory systems, has no questions and is hidden.
- **Pipeline:** `scripts/question-bank/aqa_pe/`: `fetch_pe.py` (fetch_aqa.py over 7582),
  `spec_pe.py`, `cut_pe.py` (GCSE Psychology's cutter, which is cut.py with A-Level Psychology's
  patches, plus a footer-only scheme frame and no stimulus moved down a question), `check_pe.py`,
  `tag_pe.py` and `build_pe.py`. No shared script changed. Papers are on R2 under `aqa/AQA-7582*`,
  crops under `bank/7582*`.
- **Gaps:** AQA no longer publishes the first sittings, June 2018 and 2019 (its file store answers
  "not found"), nor any AS (7581) paper (the AS has no resources page left, and none of its file
  store addresses answers), so the bank starts at November 2020. Only AQA's own site is used for PE. The specimen papers and the practical NEA are left out.

```bash
python3 scripts/question-bank/aqa_pe/fetch_pe.py
python3 scripts/question-bank/aqa_pe/spec_pe.py
python3 scripts/question-bank/aqa_pe/cut_pe.py
python3 scripts/question-bank/aqa_pe/check_pe.py
python3 scripts/question-bank/aqa_pe/tag_pe.py split   # tag each batch by tag.md's AQA PE brief, then
python3 scripts/question-bank/aqa_pe/tag_pe.py merge
python3 scripts/question-bank/aqa_pe/build_pe.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-pe
```
