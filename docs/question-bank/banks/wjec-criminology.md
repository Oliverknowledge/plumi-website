# WJEC Level 3 Criminology

Added 29 October 2026, after the founder asked for "wjec crim". It is WJEC's Level 3 Applied
Diploma in Criminology (4543), a vocational Level 3 rather than an A-Level, so its bank has a
`level` of its own, `"Level 3"`. The hub puts it on a "Level 3 vocational (Applied Diploma)"
shelf after the A-Level shelves, jump link "Level 3". The homepage's bank index lists it under
WJEC as "Level 3", after its A-Levels. `bankTitle` gives "WJEC Level 3 Criminology", and
`fullName` gives "Applied Diploma in Criminology" in the bank page's lead.

`/question-bank/wjec-criminology` has 246 parts from WJEC's 18 published papers, every one
tagged and every one with its own mark scheme crop and its scenario as a stem:
- Unit 2 (Criminological Theories, 4543UB0) and Unit 4 (Crime and Punishment, 4543UD0).
- Summer 2017, 2018, 2019, 2022, 2023, 2024 and 2025, Autumn (October) 2020 and January 2022.
- 218 parts have the examiner’s comments: every one but Summer 2017’s.

Units 1 and 3 are controlled assessments, not exams, so they aren't in the bank.

- **Papers:** three 25-mark questions, each a scenario ("1. Scenario: Richard and Geta are…")
  and then "(a)", "(b) (i)", which `cut_wjec.py` reads as they are, the scenario as the stem.
  Every part is written in the booklet, so `wjec/cut_wjec_criminology.py` ends each crop just
  under its marks ("[6]"), leaving out the dotted lines and "Additional space for Question
  1(a) only".
  - Summer 2017's Unit 4 numbers the answer lines of three "give two" questions "(i)" and
    "(ii)": those are cut as the one part the scheme marks (2(c) [10], 3(a) and 3(b) [4]).
  - Every paper adds up to 75.
- **Schemes:** 2017–2019's are ruled tables ("Question | Answer | Mark | LO"), which
  `cut_wjec.py` reads. From Autumn 2020 each part is a block: its label in the margin, the
  question again, the levels grid and the indicative content.
  - The wrapper reads these blocks by the label's column ("1." at x 72, "(a)" at 108, "(i)" at
    144). From 2023 the letter is printed again beside each sub-part.
  - Summer 2023's Unit 2 scheme lists every question first and then the blocks: a label's last
    block is its own.
  - WJEC lists two Summer 2017 Unit 2 schemes. They match except that the `4543UB0` copy
    corrects Sheldon's somatotypes, and it is the one kept.
  - The list files the 2019 schemes under "Autumn". `fetch_wjec.py` reads Criminology's series
    off each cover instead.
- **Reports:** one a series for the whole qualification, a section a unit, comments headed
  "Q.1". The contents page's last line, "Unit 4 – Crime and Punishment", runs straight into the
  general comments, so the wrapper hands `cut_wjec.py`'s reader the report from the unit's own
  heading on. 2019 also has a two-page "Summary Report"; the full report is used.
- **Topics:** `wjec/spec_wjec_criminology.py` reads the Diploma specification. (WJEC also lists
  the Applied Certificate's, which covers only Units 1 and 2; `fetch_wjec.py` skips it.)
  - Sections are the learning outcomes, "Unit 2, LO1: Understand social constructions of
    criminality".
  - Topics are the assessment criteria, with the titles from the assessment grids: 10 a unit,
    20 in all, coded `2.1.1` with `ref` "AC1.1" so the pages show the AC.
  - The 246 parts were tagged by reading them (tag.md's WJEC section), one AC each, one with
    two. Each part takes only its own unit's ACs.
- **Papers' names:** "Unit 2 · Criminological Theories", "Unit 4 · Crime and Punishment";
  series "Summer 2025", "January 2022", "Autumn 2020". `noCalc` hides the calculation filter.
- **Gaps, honestly:**
  - WJEC publishes no examiners' report for Summer 2017, so those 28 parts have none.
  - No series ran in 2021, and none is published for Summer 2026: the paper list ends at 2025,
    though the key documents already carry the Summer 2026 report.
  - The Sample Assessment Materials for Units 2 and 4 aren't in the bank.
  - The on-screen versions (4543UA0/UC0) are the same papers and aren't repeated.
  - The Welsh-medium papers aren't included.
  - Tags are one reader's, not three.
- **Pipeline** (its own work dir, `.work/wjec-criminology`):

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py scripts/question-bank/.work/wjec-criminology --only=criminology
python3 scripts/question-bank/wjec/cut_wjec_criminology.py scripts/question-bank/.work/wjec-criminology
python3 scripts/question-bank/wjec/spec_wjec_criminology.py scripts/question-bank/.work/wjec-criminology
python3 scripts/question-bank/wjec/tag_wjec.py split scripts/question-bank/.work/wjec-criminology 300   # then tag, merge
python3 scripts/question-bank/wjec/build_wjec.py scripts/question-bank/.work/wjec-criminology
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec-criminology --pdf-prefix=wjec/
```
