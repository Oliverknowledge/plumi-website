# Edexcel A-Level History

Added 1 November 2026: `/question-bank/edexcel-a-level-history`, every question from Pearson Edexcel's
A-Level History (9HI0) Papers 1, 2 and 3 that Pearson publishes on its own site, June 2017 to June 2025,
with October 2020 and November 2021. That is 1,491 questions from 40 option papers across
355 sittings. Every question has its own mark scheme crop (its indicative content, then its
section's levels grid) and 355 carry their sources or extracts as a stem; 1,124 have the
examiner's comments on their question. The coursework (9HI0/04) and the AS (8HI0) are not included.

- **Papers and routes.** Every option is a paper of its own: Paper 1's eight (`9hi01a` … `9hi01h`,
  "Paper 1H"), Paper 2's sixteen sub-options (`9hi02a1` … `9hi02h2`, "Paper 2H.1") and Paper 3's sixteen
  (`9hi030` … `9hi033`, then `9hi0341` … `9hi0392`, "Paper 37.2"). Pearson prints Paper 2's two sub-options
  (2H.1 and 2H.2) in one paper, and Papers 34 to 39's (37.1 and 37.2) likewise: each question goes to the
  option heading it is printed under, and both papers share the PDF. The **Route** filter (the existing
  `options` mechanism, as Eduqas and AQA RS use, no new page code) is the specification's route A to H:
  Papers 1 and 2 options belong to one, so picking Route H keeps 1H, 2H.1 and 2H.2 and every Paper 3
  option, which most routes can take; then Paper picks the student's own options.
- **Topics** are each option's own headings from the specification (Issue 4): Paper 1's four themes and its
  interpretations question (`1H.1` … `1H.4`, `1H.I`), Paper 2's four key topics (`2H.1.1` …), Paper 3's
  two aspects in breadth (`37.1.T1`, `T2`) and five aspects in depth (`37.1.K1` … `K5`): 216 in all, one
  tile per option ("2H.1: The USA, c1920–55…").
- **Sources and extracts.** Each paper's Sources Booklet (Papers 2 and 3) or Extracts Booklet (Paper 1) is
  bound in at the back of its question paper. The question that says "Study Sources 1 and 2…" carries
  them as its stem, cut from the booklet, and the booklet is split out as its own PDF and hosted as the
  paper's insert (`<component>-ins-<series>.pdf`), linked from the question ("Sources (insert)") and the
  whole-paper line. The row's link needs the question's opening words to name its sources or extracts:
  `QuestionRow` now reads "Extracts" as well as "extract", and Paper 1's interpretations question keeps its
  printed "Study Extracts 1 and 2…" at the front of its opening words. Ids of questions with a stem end `-q`
  (`9hi02h1-jun24-01-q`), as Geography's.
- **Either/or.** Every essay is a choice ("EITHER 3 OR 4"): each after the first of its section and option
  carries `or`, so marks count one essay.
- **Cutting:** `cut_history.py` runs `cut_pearson.py --extracts` with History's own pieces, patched from the
  wrapper so no other bank's crops move: a question's crop starts at its option heading and "Study…" line;
  the booklet's sources; the schemes' levels grids (printed before the indicative content, where `ms_tables`
  would read their rows, "1 | 1–3", as Questions 1 and 2) are left out of the read and added after each
  question's content; labels set in plain type ("1.", or June 2022's Open Sans) are read as labels; a
  header-only strip at a row's foot goes. Multi-page rows run to the next question (`carried()` unchanged).
- **Reports:** eight June 2024 reports (1A, 1D, 1G, 1H, 2B, 2C, 2G, 2H) set their text in fonts with no
  character map, so they are read by OCR (`ocr.swift`), the candidates' scripts whited out first.
- **Tags:** Claude tagged every question following `tag.md`'s "Edexcel History" section; Paper 1's Section C
  is its option's interpretations topic without asking.

Gaps, honestly:

- No exams in June 2020 or June 2021 (cancelled); October 2020 and November 2021 were sat instead, with
  fewer options (November 2021 has no 1B, 2B or 32; October 2020 no 32).
- June 2026 is listed on Pearson's site but in its teachers-only area, so it is not included; nor are the
  specimen papers (teachers-only too).
- 38 October 2020 and November 2021 "reports" are a page saying Pearson will not publish one (too few
  entries): those questions (all of November 2021's and most of October 2020's) have no examiner's
  comments, and the page is not linked as a report. 367 questions in all have no report.
- The eight OCR'd June 2024 reports may have the odd misread word.
- Paper 33 June 2025's scheme labels Question 2 "22": set by hand (`labels/9hi033-jun25.json`, `ms_alias`).
- Scheme crops are long: up to four pages of indicative content plus a levels grid.
- No past paper library page for History yet (`FILES_JSON = None`); the whole papers are on R2 under
  `edexcel/` for the bank's whole-paper links.

```bash
python3 scripts/question-bank/edexcel_history/fetch_history.py
python3 scripts/question-bank/edexcel_history/spec_history.py
python3 scripts/question-bank/edexcel_history/cut_history.py
python3 scripts/question-bank/edexcel_history/tag_history.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_history/tag_history.py merge
python3 scripts/question-bank/edexcel_history/build_history.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-history --pdf-prefix=edexcel/
```
