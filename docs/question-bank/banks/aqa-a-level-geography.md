# AQA A-Level Geography

Added 27 October 2026: `/question-bank/aqa-a-level-geography`, every question from AQA's
A-Level (7037, Papers 1–2) and AS (7036, Papers 1–2) Geography papers that AQA still
publishes, November 2020 to June 2025. That is 537 parts from 22 papers, every one with
its mark scheme cropped and tagged to a topic, and 405 with the examiner's comments.

- **Parts, each with its setup and figures.** AQA numbers parts (`01.3`), so each is a
  crop, as in the AQA sciences: the lines that set it up ("Figure 2 is in the insert.
  Figure 2 shows…", or a figure printed in the paper), then its label and words down to
  its marks, with what's printed under the marks before the answer space (an AS
  multiple-choice part's options, a table to complete). The answer lines, "Extra space"
  and the section and question headings are left out. The A-Level papers print most
  figures in a colour insert: a part that names one has it in its crop, between its
  setup and its label (106 parts), so a part shown alone under a topic still has its
  figure. Insert figures run from their bold caption to the next; a page printed
  sideways is turned upright. AS Paper 2's fieldwork scenarios ("0 3", a bare label) are
  their question's stem (`70362-jun24-03-stem.webp`).
- **Options.** A-Level Paper 1 is water and carbon cycles, one of hot deserts, coasts and
  glaciers, and one of hazards and ecosystems under stress; Paper 2 is global systems,
  changing places, and one of urban environments, population and the environment, and
  resource security. AS Paper 1 is one of water and carbon, coasts and glaciers, and one
  of hazards and urban environments; AS Paper 2 is changing places, a fieldwork question,
  and one of two fieldwork scenarios. Each option is its own area (tile) and its parts are
  tagged only to that area: `tag_geography.py merge` rejects any code outside the area
  the question is printed in. As in the Edexcel Geography bank, no part is marked `or`:
  the choices are whole questions, and `or` on a whole question would leave its card with
  no marks. `check_geography.py` checks every paper's total instead, counting one question
  of each choice and requiring a choice's questions to carry the same marks: all 22 add up
  (120 for A-Level, 80 for AS, 65 for the shortened AS Paper 2 of June 2022).
- **Mark schemes:** tables whose rows are labelled in two cells (`01` | `3`); a part's
  scheme runs from its row to the next part's, so a 20-mark question's "Marking grid for
  Question 01.4", printed after its notes, comes whole with it (the cutter checks every
  20-mark scheme has its Level 4 and every 9-mark or longer one its levels).
- **Examiner's reports** are keyed by question. Some are headed by question ("Question 1",
  "Question 01.2"); others are written by question type ("6-mark AO3 questions … Q1.3 and
  Q5.3"), and every paragraph that names a part is kept for that part's question.
- **Topics:** the specification's areas as tiles (`3.1.1 Water and carbon cycles` …
  `3.2.5 Resource security`) and their numbered topics (`3.1.1.2 The water cycle`), with
  a last tile for AS Paper 2's fieldwork (planning, collecting, presenting, analysing,
  concluding; the specification doesn't number these, so their codes aren't shown). The
  areas the AS covers are Year 1 · AS; hot deserts, ecosystems, global systems, population
  and resources are Year 2 (`aqa_geography/spec_geography.py`). AS questions use the
  A-Level codes.
- **Pipeline:** `scripts/question-bank/aqa_geography/`: `fetch_geography.py` (fetch_aqa.py
  over 7036/7037, inserts included), `spec_geography.py`, `cut_geography.py` (its own
  layout around cut.py's image helpers; cut.py is unchanged), `check_geography.py`,
  `tag_geography.py` (briefed by tag.md's AQA Geography section) and `build_geography.py`.
  Papers are on R2 under `aqa/`, crops under `bank/7036*`, `bank/7037*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (the AS) or June 2018–2019 (the
  A-Level), and sat no AS papers in November 2021, so the bank starts at November 2020.
  The specimen papers are left out, as for the other AQA banks. Component 3 (the NEA,
  the fieldwork investigation) is coursework, so there's nothing to cut. AQA published no
  reports for the November 2020 AS papers or the November 2021 A-Level papers, and its
  A-Level Paper 1 reports for November 2020, June 2023 and June 2024 are written by
  question type and name only some questions, so the rest have none. Some figures are
  withheld for copyright in AQA's own copies (its "-CR" inserts and papers: June 2025
  Paper 2's Figure 3, November 2021 Paper 2's access to clean water graph), so those
  parts show AQA's notice instead. AQA's November 2020 AS scheme prints no levels for question
  02.5. There's no past paper library page for AQA Geography yet, so the credit links to
  `/past-papers`.

```bash
python3 scripts/question-bank/aqa_geography/fetch_geography.py
python3 scripts/question-bank/aqa_geography/spec_geography.py
python3 scripts/question-bank/aqa_geography/cut_geography.py
python3 scripts/question-bank/aqa_geography/check_geography.py
python3 scripts/question-bank/aqa_geography/tag_geography.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_geography/tag_geography.py merge
python3 scripts/question-bank/aqa_geography/build_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-geography
```
