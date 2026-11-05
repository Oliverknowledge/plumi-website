# OCR A-Level Law

Added 29 October 2026: `/question-bank/ocr-a-level-law`, every question from the OCR A-Level
(H418, Papers 1–3) and AS (H018, Papers 1–2) Law papers that OCR publishes on its own site:
June 2022, the specification's first exams, to June 2025. That is 208 questions from 24 papers
(16 A-Level, 8 AS). Every question has its mark scheme cropped and its examiner's comments, and
every paper adds up to its 80 (A-Level) or 64 (AS) marks, counting one question of each choice
and one Part of Section B.

- **The option.** Component 3 is two papers: H418/03 (the nature of law and human rights) and
  H418/04 (the nature of law and the law of contract). A student sits one. They are named
  "Paper 3 (Human rights)" and "Paper 3 (Contract)", so the paper filter picks a student's option,
  and their Section B topics are year 3, listed under "Paper 3 options" in the topic list. The
  bank's note says so.
- **Questions are whole.** There are no parts and no answer lines (candidates write in a booklet).
  A question's crop ends at the line its marks are on, so it doesn't run on into the next
  Part's heading or, after the last question, OCR's copyright page.
- **Scenarios as stems.** Each A-Level Section B is "Choose Part 1 or Part 2", and each Part opens
  with two unrelated scenarios, then three questions: two "Advise…" questions on them and an
  essay. The AS Section B opens with one scenario ("Read the scenario.") and asks four questions,
  two of them "Advise…". The block, from its heading to its first question, is the stem of each
  "Advise…" question in it. The "Explain…" questions ("Do not refer to the scenario") and the
  essays have none. The scenario questions are named for their block, so they share one stem:
  `h41801-jun24-p1-05`, stem `h41801-jun24-p1-stem.webp`; the AS block is `sc`
  (`h01801-jun24-sc-06`). 80 questions have a stem. Reports are keyed by question
  (`reportsBy: "question"`).
- **Mark schemes.** Section A's scheme is a table, a row per question. Section B's are pages of
  indicative content and level grids under a heading ("5. Advise whether Kobe…", "5", "Q3",
  "7* and 10*"), with numbered lists of points among them. So `cut_ocr_law.py` finds each
  question's scheme by its own words: the first heading after the last question's that carries
  its number at the left margin and, there or just under it, most of the question's opening
  words. Failing that, its bare number. The crop runs to the next question's heading, the
  "Section B" heading, the assessment-objectives grid or OCR's back page. The Section A table's
  header row comes with it. The second Part's essay is the first Part's again, and its scheme
  says only "As per question 7" (or "SEE ABOVE FOR Q5*"), so it shows Question 7's crop.
- **Choices.** "Answer Question 1 or Question 2" (2023 on), "Answer one question from questions
  1–2" (June 2022), and Paper 3's "Answer one question" over Questions 1 and 2: the second
  carries `or`. 24 questions.
- **Reports.** Every question has its report. The second Part's essay takes the first's where
  OCR writes one report on both ("Question 7* and Question 10*"), or reports only once. H418/01
  June 2022 heads its Question 8 report "Questions 8/9" (Question 9 has its own); it is read as
  Question 8.
- **Topics.** The specification's content tables have bold topic headings with no numbers
  ("Fatal offences against the person"), so they're coded by section (`1B.3`) with an empty
  `ref`. There are 7 sections (the legal system, criminal law, law making, tort, the nature of
  law, human rights, contract) and 44 topics. The nature of law is printed for both Paper 3s and
  read once. Where two sections share a topic name, the title says whose ("Criminal law: rules
  and theory", "Tort: remedies"). 20 topics are Year 1 · AS (the AS specification has a topic of
  the same name; its "Rules" is the A-Level's "Rules and theory", and its "Introduction to the
  nature of law" opens its legal system), 11 are A-Level only and 13 are the Paper 3 options.
  Every question is tagged by reading it (tag.md's "OCR Law" section). Essays carry the
  section's evaluation topic second. No question tests the "rules and theory" topics of tort,
  human rights or contract.
- **Pipeline.** `scripts/question-bank/ocr_law/` holds:
  - `fetch_ocr_law.py`: OCR's assessment page, read with `fetch_ocr_cs.py`'s reader.
  - `spec_ocr_law.py`.
  - `cut_ocr_law.py`: `cut_pearson.py` as a library, patched for this run only, so
    `cut_pearson.py` is unchanged.
  - `tag_ocr_law.py`.
  - `build_ocr_law.py`.

  Whole papers are on R2 under `ocr/` (`OCR-H418-01-QP-JUN24.pdf`, the library's naming), and
  crops are under `bank/h418*` and `bank/h018*`.

**Gaps:**
- OCR's page lists only June 2022 to June 2025, for both levels. That is every exam series of
  this specification so far (there are no November series, and the AS's first exams, June 2021,
  were not sat). The legacy specification's papers are not on this page and are not fetched. No
  mirror (PMT or other) is used: that needs the founder's say-so.
- The sample assessment materials and modified papers (zips) are left out, as for the other OCR
  banks.
- Questions appear more than once where OCR prints them more than once: both Paper 3s share
  Section A (16 questions, 8 of them repeats), and every A-Level paper sets the same essay in
  Part 1 and Part 2 (16 repeats). They are kept, as English Literature keeps its shared Section B,
  so each paper is whole under the paper filter.
- There's no past paper library page for Law yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/ocr_law/fetch_ocr_law.py
python3 scripts/question-bank/ocr_law/spec_ocr_law.py
python3 scripts/question-bank/ocr_law/cut_ocr_law.py
python3 scripts/question-bank/ocr_law/tag_ocr_law.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_law/tag_ocr_law.py merge
python3 scripts/question-bank/ocr_law/build_ocr_law.py
ln -sfn ../img scripts/question-bank/.work/ocr-law/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-law/r2 --pdf-prefix=ocr/
```
