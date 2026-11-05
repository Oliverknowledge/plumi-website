# Edexcel International A Level Maths and Further Maths (YMA01, YFM01)

Banks: `edexcel-ial-maths`, `edexcel-ial-further-maths`

Added 2 November 2026: `/question-bank/edexcel-ial-maths` and `/question-bank/edexcel-ial-further-maths`, Pearson
Edexcel's International A Level (2018 specification, first exams 2019), every unit paper Pearson's own site has
public from January 2019 to June 2025, January, June and October series.

| Bank | Units | Papers | Questions | Scheme crops | Reports |
| --- | --- | --- | --- | --- | --- |
| Maths (YMA01) | P1-P4, M1, M2, S1, S2, D1 | 149 | 1,251 | 1,251 | 1,142 |
| Further Maths (YFM01) | FP1-FP3, M1-M3, S1-S3, D1 | 139 | 1,041 | 1,041 | 969 |

211 unit papers, 1,741 questions in all (the applied units both banks count, M1, M2, S1, S2, D1, are in both,
under the same crops). Every paper's questions add up to its 75 marks; every question has its scheme crop.

- **Naming, shared with the IAL sciences session:** board "Edexcel", level "IAL", shown as "International A Level"
  (`bankLevel`, so titles read "Edexcel International A Level Maths"); on the hub's A-Level shelf, keyed "Edexcel
  International A Level", after the UK boards; "every paper" links go to the library's
  `/past-papers/a-level-maths/edexcel-ial`. The landing page's bank index heads it "International A Level".
- **Units:** each unit is a paper ("AS Pure 1 (P1)", "Mechanics 2 (M2)", title "WME02/01") and a topic area, its
  topics the specification's numbered ones (P3.4 Differentiation; 82 in all). The AS units, P1, P2, M1, S1 and D1,
  say "AS" in their names and areas and are marked `as`. The applied units are the bank's options ("Applied
  units"): Maths offers the pairs International A Level Mathematics allows (M1 and S1, M1 and D1, M1 and M2, S1 and
  D1, S1 and S2) and International AS's single unit; Further Maths offers Mechanics, Statistics and Decision and
  their pairs, and "Further Pure only". A pick keeps the pure units and the picked units' papers and topics.
  No Year filter: the units already say which year they are.
- **Second papers:** since June 2024 some units also sat a paper in another time zone (01R, 01A). Each is a series
  of its own, `JUN24R`, `JUN25A`, "June 2025 (A)", listed after its main paper; the banks' `note` says so.
- **Sources, Pearson's own site only:** its search index, filtered to the 2018 specification's files
  (`ial18-mathematics`: the FP, M and S codes are the 2013 specification's too), series read off Pearson's own tag
  on each file (October 2020 sat the papers printed for May 2020). Two files are named off-pattern
  (`wma12-01-mcs-20190815.pdf`, `Question-paper-Unit-3-WMA13- January-2020.pdf`). 538 of the 623 files are the
  past paper library's copies already on R2 (`edexcel/EDX-W…`, matched by MD5); the other 85 are on R2 as
  `edexcel-ial/<unit>-<kind>-<series>.pdf`.
- **Cut** with the UK Edexcel Maths cutter for the questions (`cut_edexcel.py`'s `qp_regions`, `qp_marks`) and the
  shared Pearson scheme reader (`cut_pearson.py`'s `ms_tables`, with `carried()`), through
  `edexcel_ial_maths/cut_ial_maths.py`, which forks neither. What it adds:
  - questions: the 2019 papers' "Leave blank" column (the legacy frame); Decision 1's answer book, bound in after
    the questions, kept out; each crop edge settled on a row with no ink (a matrix standing taller than its label
    had its top bracket cut; a "(6)" 4pt over the answer line its foot);
  - schemes, through `SchemeLines`: labels printed "1.(a)", "2 .(a)", "7ai", "4." told from the working by order,
    shape and column (Pearson bolds few of them and places them anywhere across a wide column; "9e−0.75t" and a
    notes page's "4" are not labels); every part label moved out of the column, as each question's Notes repeat
    "(a)", "(b)" and the reader kept a repeated label's first rows only (losing notes pages); the headings Pearson
    uses ("QUESTION NUMBER", "Qu", "Q", "Questio"/"n") read as "Question"; a centred label lifted to its row's
    top (Decision 1's networks lost their tops); pictures and diagrams given a line, so a page of pictured working
    is kept; the page box widened to the text under the table and down to the foot (fraction bars ended crops),
    the page numbers and Pearson's company notice left out; a question's rows laid out from its label's row to the
    next question's, over every page between.
- **Checks** (`check_ial_maths.py`, run over every paper, none left): no crop edge runs through ink (rows looked at
  pixel by pixel, the tables' rules aside); Question 1 opens on its own label, never the cover or the formulae
  note; each scheme crop opens on its own label and runs to the next question's start with nothing between but
  the table's heading; its printed total ("(9 marks)") matches the question's marks; every paper makes 75. Crops
  were also looked at by eye: Decision networks, multi-page schemes, 2019 papers, matrices at a question's top.
- **Topics:** tagged by Claude subagents per tag.md's IAL section, each question from its own unit's topics, one
  or two.
- **Re-cut, 3 November 2026 (`cropVersion` 3):** testing found schemes that start a question with a bare "2" and
  print "2(e)" where it carries over a page: the cutter took "2(e)" as the start, so Question 1's crop ran on
  through 2(a) to (d) and Question 2's opened at (e) (Further Pure 1, June 2025). A question now starts only on its
  first part ("2", "2.", "2(a)", "2(i)"); a bare number counts where it heads a table row, and gives way to a
  printed "7(a)" unless it sits under its table's heading. A merged "Question Scheme" heading, notes in the
  label column left of a label, and the guidance's numbered paragraphs before the first table no longer move a
  start. The checker now looks for both faults (a crop opening past its question's first part, or holding the
  next question's opening): 398 scheme crops changed (240 of Maths' 1,251, 312 of Further Maths' 1,041, the
  shared units counted in both), no question crops. Six of its flags remain, each looked at by eye: a number in
  the working read as a label, the crop itself right.
- **Pipeline:** `scripts/question-bank/edexcel_ial_maths/`: `fetch_ial_maths.py`, `library_ial_maths.py`,
  `cut_ial_maths.py`, `check_ial_maths.py`, `tag_ial_maths.py`, `build_ial_maths.py`; topics in
  `ial_maths_topics.json`. Ids `wma13-jun22-09`, `wfm02-jun25a-03`; crops under `bank/` with those names.

## Gaps

- **Held back:** Pearson lists October 2025, January 2026 and June 2026 for teachers only.
- **Not public:** the question papers for P1 and P2 October 2019 (their schemes are public, so left out); FP1 June
  2019 and January 2020; M1 June 2019 and October 2019; S1 June 2019, October 2019 and January 2020.
- **Not sat:** June 2020 (cancelled; October 2020 sat those papers). FP1-FP3, M3, S3 and D1 have no October series.
- **Examiner's reports:** none for June 2021; elsewhere, the questions the examiners wrote about.
- **The 2013 specification** (C12, C34, the old FP, M and S units before 2019) is left out.

```bash
pip install pymupdf pillow boto3
python3 scripts/question-bank/edexcel_ial_maths/fetch_ial_maths.py
python3 scripts/question-bank/edexcel_ial_maths/library_ial_maths.py
python3 scripts/question-bank/edexcel_ial_maths/cut_ial_maths.py
python3 scripts/question-bank/edexcel_ial_maths/check_ial_maths.py   # expect "0 problems"
python3 scripts/question-bank/edexcel_ial_maths/tag_ial_maths.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_ial_maths/tag_ial_maths.py merge && python3 scripts/question-bank/edexcel_ial_maths/build_ial_maths.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-ial-maths --crops-only --checksum
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-ial-maths/upload --pdf-prefix=edexcel-ial/
```
