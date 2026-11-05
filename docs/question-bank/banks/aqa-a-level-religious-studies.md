# AQA A-Level Religious Studies

Added 31 October 2026: `/question-bank/aqa-a-level-religious-studies`, every question from
AQA's A-Level Religious Studies (7062) papers that AQA still publishes, November 2020 to
June 2025: Paper 1 (Philosophy of religion and ethics) and all five Paper 2 options (2A
Buddhism, 2B Christianity, 2C Hinduism, 2D Islam, 2E Judaism). That is 288 parts from 36
papers, every one with its mark scheme and tagged, and 128 with the examiner's comments
on that part. Every paper's marks add up to its 100 (Paper 2 counting one essay of each
either/or pair).

- **Parts.** Paper 1 is four two-part questions (01.1 Examine… [10], 01.2 a claim to
  evaluate [15]); Paper 2 is two of those on the religion, then two dialogue essays to
  choose between in each of Sections B and C (03.1 or 04.1, 05.1 or 06.1, [25] each). A
  part is one crop ending at its marks, without the "Question 2" heading, the section's
  instructions or the "and"/"Either"/"or" between parts. Ids are `70622b-jun24-03-1`;
  reports are keyed by part (`reportsBy` "question"). No calculations (`noCalc`).
- **Religion filter.** Paper 2's papers and each religion's section carry their
  `option` (A–E, AQA's own lettering), and the bank its `options` ("Religion"), the
  filter Eduqas Religious Studies added: picking Islam keeps Paper 2D, Islam's topics,
  and Paper 1, which everyone sits. No page code was needed.
- **Mark schemes, whole.** A scheme's own pages hold only the question's indicative
  content (a 25-mark essay's runs over two pages, AO1 then AO2); the levels it is marked
  by are two grids at the front of the scheme ("Levels of Response: 10 marks A-Level –
  AO1", "15 marks … AO2"). Each scheme crop is the part's content, every page of it, then
  the grid its marks use: AO1 for a 10-mark part, AO2 for a 15-mark one, both for a
  25-mark essay. Every scheme line from the first question on is inside some crop
  (checked for all 36 schemes).
- **Topics:** 68, from the specification (`aqa_rs/spec_rs.py`): Paper 1's Section A
  (6: Arguments for the existence of God … Self, death and the afterlife) and Section B
  (7: Normative ethical theories, Issues of human life and death, Issues of animal life
  and death, Meta-ethics, Free will and moral responsibility, Conscience, Bentham and
  Kant), then each religion's nine Section A topics and its two dialogues. A dialogue
  essay is tagged to its dialogue and to the topic it debates (tag.md, "AQA Religious
  Studies"), so Paper 1's Miracles topic also lists every religion's essays on miracles.
  Every topic has questions. All are year 0.
- **Pipeline:** `scripts/question-bank/aqa_rs/`: `fetch_rs.py` (fetch_aqa.py over 7062),
  `spec_rs.py`, `cut_rs.py` (cut_philosophy.py, with the "Question N" heading and section
  instructions treated as heading lines, the levels grids added to each scheme crop and
  a per-part report reader; cut.py, cut_psychology.py and cut_philosophy.py are
  unchanged), `tag_rs.py` and `build_rs.py`. Papers are on R2 under `aqa/AQA-7062*`,
  crops under `bank/7062*`.
- **Reports:** AQA's reports comment part by part ("1.1 Examine…", "01.1", "Question
  1.1", "3.1:"); each part gets its own. Where a report repeats the question with no
  marks after it (June 2023 Paper 1), the question's words are taken off the front.
  Paper 2B June 2024's report prints no "2.2" over that part's comment: it is found by
  its question and marks inside 2.1's.
- **Gaps:** AQA no longer publishes June 2017 to June 2019 (its file store answers "not
  found"), so the bank starts at November 2020. AQA's specification has no Sikhism
  option, so there is no Paper 2F. The specimen papers and exemplar answers are left out,
  as for the other AQA banks. AQA published reports only for June 2022–2025 Papers 1, 2A
  and 2B, June 2022, 2024 and 2025 Paper 2D and June 2022 Paper 2E; the other 160 parts
  (all of November 2020 and 2021, and every Hinduism paper) have none. There's no past
  paper library page for Religious Studies, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_rs/fetch_rs.py
python3 scripts/question-bank/aqa_rs/spec_rs.py
python3 scripts/question-bank/aqa_rs/cut_rs.py
python3 scripts/question-bank/aqa_rs/tag_rs.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_rs/tag_rs.py merge
python3 scripts/question-bank/aqa_rs/build_rs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-rs
```
