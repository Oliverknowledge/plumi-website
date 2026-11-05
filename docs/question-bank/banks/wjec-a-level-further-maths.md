# WJEC A-Level Further Maths

Added 3 November 2026, after the founder asked for it: `/question-bank/wjec-a-level-further-maths`,
the Wales specification (AS 2305, A Level 1305), 259 whole questions from WJEC's 33 published
papers: AS Units 1 to 3 from Summer 2018, A2 Units 4 to 6 from Summer 2019 (the first A2 sitting),
Summers 2018, 2019 and 2022 to 2025. Every question has marks, topics and a scheme crop; every
paper's marks add up to its total (AS 70, Unit 4 120, Units 5 and 6 80). 256 have the examiners'
comments: WJEC prints none worth showing on the other three (Unit 1 2023 Q5 says only "Overall, a
well-answered question."; Unit 6 2023 Q5 and Unit 3 2024 Q3 have no comment).

| Unit | Paper | Marks | Questions |
| --- | --- | --- | --- |
| AS Unit 1 (2305U10) | Further Pure Mathematics A | 70 | 54 |
| AS Unit 2 (2305U20) | Further Statistics A | 70 | 39 |
| AS Unit 3 (2305U30) | Further Mechanics A | 70 | 40 |
| A2 Unit 4 (1305U40) | Further Pure Mathematics B | 120 | 60 |
| A2 Unit 5 (1305U50) | Further Statistics B | 80 | 36 |
| A2 Unit 6 (1305U60) | Further Mechanics B | 80 | 30 |

- **Source: WJEC's own site only.** Further Maths has no qualification page of its own: the
  Maths page's past papers and key documents list its papers, its specification and its reports
  beside Maths's, so `fetch_wjec.py --only=further` reads that page and keeps the 305 stem.
  Whole papers are the library's `wjec/WJEC-2305U10-1-QP-JUN23.pdf`; the reports are
  `wjec/WJEC-further-ER-JUN23.pdf`.
- **Options.** The specification has A2 candidates sit Unit 4 and either Unit 5 or Unit 6 (the
  AS units are all compulsory), so the bank's "A2 option" filter takes Further Statistics B or
  Further Mechanics B, as AQA's Further Maths does its pairs.
- **Topics** are the specification's own, 31 of them by unit (`wjec/spec_wjec_further.py`):
  its 2.4.3 is `4.3`. Unit 2's two broad headings are split at their sub-headings, and titles
  say which unit's complex numbers or matrices they are, so no two read alike.
- **Year filter:** A2 units are Year 13 without any reading (`year13.json`, written by the build).
- **Cutting.** Whole questions, as Maths. WJEC's schemes come in five layouts across these
  years, and cut_pearson's table reader takes working for labels in several (it gave Unit 4
  2024's Q1 rows to Q3), so `cut_wjec.py` finds each question's start itself (`label_starts`): the
  number in the page's leftmost column, shaped like a label, counted only as the next question,
  and believed only if it finds every question on the paper. Mechanics 2022 and 2023 draw their
  "Q1" header as a picture, so there the table's blue header cell is counted instead. A question
  runs on to the next question's start, past its "Total for Question 1": Mechanics prints a "Q1
  Alternative Solution" table after that row, and those rows were being lost. A page's box takes
  in all its text, as drawn rules can stop short or, on 2018's unruled Unit 3, be only a diagram's.
- **Answer lines.** Since 2024 the papers are answered in the paper, with pages of dotted lines:
  crops ran to 5,800px. `--squeeze` takes bands of those dashed rules out (median question crop
  2,900px to 550px). WJEC Maths's 2024 and 2025 crops still have the lines (median 2,200px).
- **Check:** `wjec/check_wjec_fm.py` (another question's number in a scheme crop, a scheme missing
  its own, ink cut by a crop edge, a line on a scheme page in no crop or clipped at its side, the
  printed total against the paper's marks, marks against the paper's total), then every crop's top
  and bottom by eye on contact sheets. What it still reports is explained: Unit 6 2022's numbers
  are pictures, so "own number" can't be read, and "Total 120" is a match on "120.7".

Gaps: WJEC's public list has no Summer 2026 papers yet, though its Summer 2026 report is up (left
out until the papers are). No 2020 or 2021 papers, none being sat in summer. The specimen papers
aren't cut, having no series.

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py scripts/question-bank/.work/wjec-fm --only=further
python3 scripts/question-bank/wjec/cut_wjec.py scripts/question-bank/.work/wjec-fm --whole --squeeze
python3 scripts/question-bank/wjec/check_wjec_fm.py scripts/question-bank/.work/wjec-fm --whole --squeeze
python3 scripts/question-bank/wjec/tag_wjec.py split scripts/question-bank/.work/wjec-fm 300   # tag, then: merge
python3 scripts/question-bank/wjec/build_wjec.py scripts/question-bank/.work/wjec-fm
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec-fm --pdf-prefix=wjec/
```
