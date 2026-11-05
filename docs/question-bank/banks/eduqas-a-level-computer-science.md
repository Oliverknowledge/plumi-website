# Eduqas A-Level Computer Science

Bank: `eduqas-a-level-computer-science`

Added 5 November 2026: `/question-bank/eduqas-a-level-computer-science` (A-Level A500 and AS B500), on the Eduqas
A-Level shelf. There's no `a-level-computer-science` subject in the past paper library, so it links to no library page.

| Paper | Series | Parts | Marks |
| --- | --- | --- | --- |
| Component 1: Programming and System Development | June 2017-19, Autumn 2020-21, June 2022-25 | 223 | 900 of 900 |
| Component 2: Computer Architecture, Data, Communication and Applications | same | 244 | 900 of 900 |
| AS Component 1: Fundamentals of Computer Science | June 2016-19, Autumn 2020, June 2022-25 | 220 | 900 of 900 |
| AS Component 2: Practical Programming to Solve Problems | same | 92 | 492 of 540 |

779 parts from 36 papers. Every part has its own scheme rows and 600 have the examiner's comments on their question.
Topics: the 17 the A-Level specification numbers (`1.1` Data structures … `1.9`, `2.1` Hardware and communication …
`2.8`). All but `1.6` System design are AS content too.

- **Components, confirmed on eduqas.co.uk:** A-Level Components 1 and 2 are written papers of 2h45, 40% each, 100 marks.
  Component 3 is non-exam work with no paper. AS Component 1 is written (2h, 70%). AS Component 2 is on screen
  (2h15, 30%, 60 marks), not a written paper.
- **AS Component 2 is sat around a scenario and a given program.** Each question's stem carries the scenario, printed
  before question 1, as no question repeats it. The last question is the programming task:
  - "Open the file X … Complete this code", and annotating that code (Autumn 2020), needs a program only centres get in
    an encrypted file. Those parts are left out, as AQA Paper 1's Skeleton Program questions are: 4 marks a paper,
    8 in June 2022 and 2023 and Autumn 2020. So the papers come to 52 or 56 of 60. The bank's note says so.
  - "Create a new form or program…" and annotating that stand on their own and are here. A few still mention the
    given program in passing: June 2022 and 2023's "navigate between the … form and this new form".
  - Until 2020 and in 2023 the paper prints the task three times, once per language, with one scheme row for all three.
    Python's copy is kept, with its section's opening words in the stem. The rest print it once for any language.
- **Eduqas lists AS Component 2's June 2022 question paper as a "[Resource]"**, so it looks missing: the file is the
  whole paper. `fetch_eduqas_cs.py` files it as the paper. Its last pages are 7-Zip instructions, past "END OF PAPER".
- **Pipeline:** `scripts/question-bank/eduqas_cs/`, close to `eduqas/`:
  - `fetch_eduqas_cs.py`: `eduqas/fetch_eduqas.py`, unchanged, over qualification 38409.
  - `cut_eduqas_cs.py`: `eduqas/cut_eduqas.py`, unchanged, as a library for papers and reports. New: a scheme reader
    for this table ("Q | Answer | Mark | AO1 AO2 AO3 | Total", not the sciences' "Question | Marking details"), with the
    label written every way ("1(a)", "1cii", "(b) (i)", "5aiii" stacked in one cell, "4. (i)" for 4(a)(i), 4(b)(i) and
    4(c)(i)). A band table's "3", "2", "1", "0" stay in their question's row. Also new: AS Component 2's handling,
    2017's "1. The majority of candidates…" reports, which the shared reader skips, and a line with no letters at a
    page's foot ("£275.50. [1]"), which the shared `area` cuts through.
  - `spec_eduqas_cs.py`: new, the specification's layout has no "Overview" headings.
  - `eduqas/tag_eduqas.py`, unchanged, and `tag/eduqas-a-level-computer-science.md`.
  - `build_eduqas_cs.py`: `eduqas/build_eduqas.py`, unchanged, plus `sk`, the note and short topic names.
  - `scripts/question-bank/labels/a500u20-oct20.json`: that scheme numbers 2(a) and 2(b) as "2 (i)" and "(ii)".
  `computer_science/` gave the tagging rules and the left-out approach; none of its code runs here, as its cutters are for
  other boards' layouts.
- **Tagging:** `tag_eduqas.py split` clips a topic's words at 1,500 characters, which hid compression and shortest paths
  (`1.3`) and networks and protocols (`2.1`) from the readers. `tag/overrides.json` in the work directory moves the 33
  parts that sent elsewhere, and the tag notes now say where these go.
- **Gaps:** Eduqas puts papers up a year after the exam, so there's no June 2026 yet, though its A-Level report is up.
  June 2016 is AS only, as the A-Level was first sat in 2017. No AS in Autumn 2021. Examiner's reports: none for Autumn
  2021, AS Autumn 2020 or AS June 2025; A-Level Autumn 2020's has general comments only, so its parts have none. June
  2024 and 2025's A-Level Component 2 reports skip a few questions. Large-print papers are left out.
- **Odd but left alone:** a scheme's "Total" digit can sit across a row's rule (A-Level Component 2 June 2023 Q2), so
  a sliver of it shows at the foot of one row and the top of the next. A-Level Component 1 June 2018 draws no rules
  between rows, and 6(a)'s crop ends with a sliver of the diagram in 6(b)'s row. AS Component 2 June 2017 Q3's scheme
  has a scrap of a repeated head ("rk") where it crosses a page. The whole-paper PDFs on R2 are the
  board's own, and some of AS Component 2's print the password for that exam's files, which is of no use now.

```bash
python3 scripts/question-bank/eduqas_cs/fetch_eduqas_cs.py        # prints the gaps
python3 scripts/question-bank/eduqas_cs/spec_eduqas_cs.py
python3 scripts/question-bank/eduqas_cs/cut_eduqas_cs.py          # --only=a500u10-jun24
python3 scripts/question-bank/eduqas/tag_eduqas.py split scripts/question-bank/.work/eduqas-cs 200   # tag, then: merge
python3 scripts/question-bank/eduqas_cs/build_eduqas_cs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-cs --pdf-prefix=eduqas/
npm run bank:data -- eduqas-a-level-computer-science --verify
```
