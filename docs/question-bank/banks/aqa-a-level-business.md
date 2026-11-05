# AQA A-Level Business

Added 27 October 2026, after a student asked for it: `/question-bank/aqa-a-level-business`,
every question from AQA's A-Level (7132, Papers 1–3) and AS (7131, Papers 1–2) Business
papers that AQA still publishes, November 2020 to June 2025. That is 393 questions from 28
papers, every one with its mark scheme cropped or its multiple-choice answer, tagged to a
topic, and 204 with the examiner's comments.

- **Questions and parts.** A-Level Paper 1 is 15 multiple-choice questions, short answers
  (16–20; November 2021 sets two of them on data with parts, 16.1–16.4 and 17.1–17.2), then
  EITHER/OR essays in Sections C and D. Paper 2 is three cases, each its text and appendices
  then its parts (01.1–01.5). Paper 3 and AS Paper 2 are one case study, printed in the
  insert, and six or eight whole questions on it. AS Paper 1 is 10 multiple-choice
  questions, short answers 11–15, then two short cases with parts (16.1, 16.2, 17.1, 17.2).
  So ids are cut.py's own (`71322-jun24-01-3`, `71321-jun24-18`), and a question ends at its
  marks (the answer lines and pages are left out); multiple choice runs to the next label,
  so its options stay with it.
- **Case material as stems.** A part's stem is its question's case, from the question's
  label to its first part (`71322-jun24-01-stem.webp`), so "Show how question 01 starts"
  opens the case and its appendices. Paper 3's and AS Paper 2's questions share the insert's
  case study as one stem (`71323-jun24-stem.webp`, every page up to "END OF SOURCE"). A few
  papers print data several questions use ("Questions 16, 17 and 18 are based on the data
  provided in Table 1"): where it sits above the first question's label every member shares
  it as `<set>-stem.webp`; where it sits beside the first label ("1 4  Questions 14 and 15 are
  based on the network below"), the first question keeps it in its own crop and the others
  share it. A downloaded set prints each stem once.
- **Either/or.** The second essay of each pair in A-Level Paper 1's Sections C and D
  ("OR", lower case in 2021 and 2022) carries `or`, so every A-Level paper adds up to its 100
  marks and every AS paper to its 80.
- **Mark schemes:** not tables: each question is its label, its words again, its own
  levels-of-response grid and indicative content, up to the next label. Every grid is
  printed with its question, so none is shared and none is cut apart from it (a grid that
  runs over a page is two pieces of one crop). The header and footer rules, which even pages
  draw from the left edge, are left out. Multiple-choice answers come from Section A's
  "Question number / Answer" table (`k`).
- **Reports:** headed "Question 16", "Question 16.1", "Q16:" (Paper 1, 2022–23) or just
  "1.1"; a whole question's comments are gathered under it, each part headed by its label,
  as the other AQA science banks key them. Paper 3's reports from 2023 open with a contents
  list and quote student answers as images; the examiner's commentary on them is kept.
- **Topics:** the specification's ten areas as tiles (`3.1 What is business?` …
  `3.10 Managing strategic change`) and their 42 numbered topics under them ("3.7.2
  Analysing the existing internal position of a business to assess strengths and
  weaknesses: financial ratio analysis", shown short where the title is long: "Financial
  ratio analysis"). 3.1–3.6 are the AS content (Year 1 · AS), 3.7–3.10 A-Level only. The
  tree is read from the current specification (version 2.0, June 2023, linked from AQA's
  7132 page), whose numbering is the 2015 one's. AS questions are tagged with AS topics only.
- **Pipeline:** `scripts/question-bank/aqa_business/`: `fetch_business.py` (fetch_aqa.py
  over 7131/7132, inserts included), `spec_business.py`, `cut_business.py` (cut_economics.py's
  page frames and spans, with Business's own layout; cut.py and cut_economics.py are
  unchanged), `tag_business.py` (tag_pearson.py, briefed by tag.md's AQA Business section)
  and `build_business.py`. Papers are on R2 under `aqa/`, crops under `bank/7131*`, `bank/7132*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (its file store has none of them), and
  sat no AS papers in November 2021, so the bank starts at November 2020. The specimen
  papers are left out, as for the other AQA banks. AQA published no reports for November
  2021 or AS November 2020. There's no past paper library page for AQA Business yet, so the
  credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_business/fetch_business.py
python3 scripts/question-bank/aqa_business/spec_business.py
python3 scripts/question-bank/aqa_business/cut_business.py
python3 scripts/question-bank/aqa_business/tag_business.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_business/tag_business.py merge
python3 scripts/question-bank/aqa_business/build_business.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-business
```
