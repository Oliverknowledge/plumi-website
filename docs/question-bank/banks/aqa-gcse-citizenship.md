# AQA GCSE Citizenship Studies

Added 3 November 2026: `/question-bank/aqa-gcse-citizenship`, every part from AQA's GCSE
Citizenship Studies (8100) Paper 1 (Active citizenship; Politics and participation) and Paper 2
(Life in modern Britain; Rights and responsibilities) that AQA still publishes, November 2020
to June 2025. That is 306 parts from 12 papers (80 marks each), every one tagged to a topic;
96 multiple-choice parts with their answer letters ("D", or "C and F" for "Shade in the two
correct answers"), the other 210 with their mark scheme cropped, and 68 questions with the
examiner's comments (AQA published no report for November 2020 or November 2021).

- **Questions:** `cut.py`'s part finder. A source ("Source A …") is printed inside the part that
  uses it, so a source-based part's crop carries its source, charts and all. Three fixes, made
  from `cut_gcse_citizenship.py` without changing `cut.py`: a page with "Extra space" on it
  ends a part only when nothing else is printed there (the 8-mark source question prints its
  source on one page and its question on the next, which had been dropped); no setups are
  moved (`move_setups` had taken multiple-choice options and their marks into the next part);
  and a section's heading or "Question 1 continues on the next page" is cut off the part above
  it. Paper 1's question 2 (the student's own investigation) and Paper 2's question 8 (a source
  listing the options) are stems shown above their parts (48 parts).
- **Mark schemes:** tables of "Qu | Part | Marking guidance | Total marks", a table per part from
  June 2022, one ruled table before. A part's scheme runs from its table's (or row's) top to the
  next part's, across pages, so an 8- or 12-mark scheme keeps its whole levels grid and its
  indicative content; the cutter checks for both, and that each scheme reprints its part's
  question. Multiple choice is keyed from "Correct response: C (Equal Pay Act) and F (Race
  Relations Act)" ("Correct answer – B" in November 2020, whose papers print no "Shade in…"
  line), and each letter's words are checked against the question paper's option. Where a
  report names the answer, all 19 agree.
- **Reports:** a heading per part ("Question 03.1 (Multiple choice)", or the bare "01.1" in
  Paper 1, June 2022); a question's report is its parts' comments, each under its label.
- **Topics:** the four themes as tiles and 61 topics: each key question's content bullets
  (`3.4.3.2 Other voting systems`), with each theme's "how citizens make a difference" content
  kept once under 3.5.1 (actions, groups, the media, working together) and the investigation's
  stages under 3.5.2. Every topic has at least one part.
- **Pipeline:** `scripts/question-bank/aqa_gcse_citizenship/`: `fetch_gcse_citizenship.py`
  (`fetch_aqa.py` over 8100), `spec_gcse_citizenship.py`, `cut_gcse_citizenship.py`,
  `tag_gcse_citizenship.py` (briefed by tag.md's AQA GCSE Citizenship Studies section) and
  `build_gcse_citizenship.py`. Papers are on R2 under `aqa/AQA-8100*`, crops under `bank/8100*`.
- **Gaps and oddities:** June 2018 and June 2019 are no longer on AQA's site (its file store
  redirects), so the bank starts at November 2020. AQA publishes November 2021's Paper 1 only
  with its copyright material removed: 05.3's Source D (a politician's social media posts) is a
  blank box saying so. The specimen papers are left out, as for the other AQA banks. No library
  page (`/past-papers`) yet.

```bash
python3 scripts/question-bank/aqa_gcse_citizenship/fetch_gcse_citizenship.py
python3 scripts/question-bank/aqa_gcse_citizenship/spec_gcse_citizenship.py
python3 scripts/question-bank/aqa_gcse_citizenship/cut_gcse_citizenship.py
python3 scripts/question-bank/aqa_gcse_citizenship/tag_gcse_citizenship.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_citizenship/tag_gcse_citizenship.py merge
python3 scripts/question-bank/aqa_gcse_citizenship/build_gcse_citizenship.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-citizenship
```
