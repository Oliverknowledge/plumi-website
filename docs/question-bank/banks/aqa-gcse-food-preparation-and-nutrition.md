# AQA GCSE Food Preparation and Nutrition

Added 3 November 2026: `/question-bank/aqa-gcse-food-preparation-and-nutrition`, every question
from AQA's GCSE Food Preparation and Nutrition (8585) written paper (8585/W, Food preparation and
nutrition) that AQA publishes: November 2020, November 2021 and June 2022 to June 2025. That is
215 questions and parts from 6 papers, every paper adding up to its 100 marks, every one tagged.

- **Questions.** Section A is question 01: twenty 1-mark multiple-choice parts (01.1 to 01.20,
  options A–D), 120 in all, each carrying its letter (`k`) instead of a scheme crop. Section B is
  questions 02–06, mostly in parts ("0 3 . 2"), now and then a whole question (June 2025's
  12-mark "0 4"); a shared ingredient list or scenario printed above a question's parts is their
  stem (17 parts).
- **Mark schemes:** each Section B part's row of AQA's "Qu | Part | Marking guidance" table, cut
  from its label to the next and across pages, so a levels-marked answer brings its whole grid and
  its indicative content (95 crops). Each multiple-choice key is read from Section A's "D – Yellow"
  rows and checked against the question paper's option D before it is kept.
- **Examiner's reports:** June 2022 to June 2025 (24 questions). AQA's reports comment part by part
  ("Question 2.1"); each question's report keeps a "Question 02.1" heading over each part's
  comments, so the report panel shows a part's own comments first. AQA published none for November
  2020 or November 2021.
- **Topics:** the specification's five areas as tiles (Food, nutrition and health; Food science;
  Food safety; Food choice; Food provenance) and their 33 numbered topics under them (`3.2.1.1`
  Protein … `3.6.2.2` Technological developments). British and international cuisines (`3.5.2`)
  and Sensory evaluation (`3.5.3`) have no headings under them and are topics themselves. Food
  science's four "functional and chemical properties" topics have short names ("Proteins in
  cooking") so they don't share an address with the nutrition topics. The food preparation skills
  (3.1) and techniques (3.7) run through the whole specification and are not topics.
- **Pipeline:** `scripts/question-bank/aqa_gcse_food/`: `fetch_food.py` (fetch_aqa.py over 8585,
  reading the paper's "8585W" file names), `spec_food.py`, `cut_food.py` (cut.py with patches made
  from it, no shared script changed: the scheme's split "Qu | Part" labels, the scheme frame inside
  the page-wide header and footer rules, a part ended above the "Section B" heading, multiple-choice
  options and a table's "An example has been completed for you." kept with their own part, and a
  table's bottom rule just under the frame kept, but not the page's own border, which would keep
  the white space above it, and not "Question 2 continues on the next page"; 105 crops re-cut for
  those on 4 November 2026, `cropVersion` 1), `tag_food.py` and `build_food.py`. Papers are on
  R2 under `aqa/AQA-8585W*`, crops under `bank/8585w*`.
- **Gaps:** AQA no longer publishes the first sitting, June 2018, nor June 2019's question paper
  (its file store redirects; only June 2019's mark scheme is still listed, so that series is left
  out), so the bank starts at November 2020. Only AQA's own site is used. The specimen paper, the
  modified (large print) papers and the NEA (8585/C, coursework) are left out. There is no Food
  Preparation and Nutrition page in the past paper library, so there is nothing to link to and back.

```bash
python3 scripts/question-bank/aqa_gcse_food/fetch_food.py
python3 scripts/question-bank/aqa_gcse_food/spec_food.py
python3 scripts/question-bank/aqa_gcse_food/cut_food.py
python3 scripts/question-bank/aqa_gcse_food/tag_food.py split   # tag each batch by tag.md's AQA GCSE Food brief, then
python3 scripts/question-bank/aqa_gcse_food/tag_food.py merge
python3 scripts/question-bank/aqa_gcse_food/build_food.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-food
```
