# Edexcel A-Level Business

Added 1 November 2026: `/question-bank/edexcel-a-level-business`, every question from
Pearson's A-Level (9BS0) Business Papers 1 to 3 that Pearson publishes, June 2017 to June 2025
(June 2026 is for teachers only), nine sittings including October 2020 and November 2021.
That is 252 parts from 27 papers, every one with its mark scheme crop, its extracts and the
examiner's comments. The AS (8BS0) papers are a separate qualification and aren't in the bank.

- **Papers:** Paper 1 "Marketing, people and global businesses" (Themes 1 and 4) and Paper 2
  "Business activities, decisions and strategy" (Themes 2 and 3) are two data response
  questions on extracts, parts (a) to (e): 4, 4, 10, 12 and 20 marks. Paper 3 "Investigating
  business in a competitive environment" (all four themes, a context announced the year
  before) is two questions of four parts: 8, 10, 12 and 20 marks. Every paper is 100 marks,
  all compulsory, and every cut paper adds up to 100.
- **Topics:** the specification's 20 numbered topics as tiles ("1.3 Marketing mix and
  strategy") and 80 sub-topics under them ("1.3.3 Pricing strategies"), shown by area: there
  is no AS split (`edexcel_business/spec_business.py`). 76 sub-topics have questions.
- **Extracts:** `cut_pearson.py --extracts` attaches a question's extracts to its stem. To June
  2022 they are printed in the paper; from June 2023 they are in a Source Booklet bound in at
  the back, its blocks headed "SECTION A". `cut_business.py` reads those wordings ("Read the
  extracts (A to C) in the Source Booklet", "Read Extracts A to C…") and the booklet.
- **Lead-ins:** most 20-mark parts (and a few others) print their premise above the part's
  label: "Dr Kye is considering a broadly democratic or broadly paternalistic leadership
  style." over "(e) Evaluate these two options…". The cutter gave those words to the end of
  the part before, whose crop stops at its marks, so no crop showed them. `cut_business.py`
  starts the part at them (67 parts).
- **Schemes:** each long answer's crop runs from its indicative content to the end of its
  levels grid (Level 4; Paper 3's 8-mark parts stop at Level 3), over two to four pages. Each
  grid's "0 | No rewardable material" row read as a question numbered 0 and ended the answer
  above at its grid's header row (about half the long answers); a wrapped "Knowledge 2" did
  the same once. Business labels every row "2 (a)" on one line, so `cut_business.py` ignores
  bare numbers in the label column. No label is repeated over a page, so `carried()` has
  nothing to join here. `check_business.py` checks marks, stems and one grid per long answer.
- **Reports:** November 2021's head parts "Question 1a"; June 2024 Paper 2's has no character
  map and is read by OCR, its candidates' scripts whited out first (as Geography B).
- **Pipeline:** `edexcel_business/` holds thin wrappers over the Pearson scripts:
  `fetch_business.py`, `spec_business.py`, `cut_business.py`, `check_business.py`,
  `tag_business.py` (tag.md's "Edexcel Business" section) and `build_business.py`. Whole papers
  are on R2 as `edexcel/9bs0-<paper>-<kind>-<series>.pdf`, crops as `bank/9bs0*`.
- **Gaps:** there is no past paper library page for A-Level Business (for any board) yet, so the
  bank's credit links to `/past-papers`. Paper 3's pre-release context isn't hosted on its own.

```bash
python3 scripts/question-bank/edexcel_business/fetch_business.py
python3 scripts/question-bank/edexcel_business/spec_business.py
python3 scripts/question-bank/edexcel_business/cut_business.py     # cut_pearson.py --extracts, with Business's readings
python3 scripts/question-bank/edexcel_business/check_business.py
python3 scripts/question-bank/edexcel_business/tag_business.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_business/tag_business.py merge
python3 scripts/question-bank/edexcel_business/build_business.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-business --pdf-prefix=edexcel/
```
