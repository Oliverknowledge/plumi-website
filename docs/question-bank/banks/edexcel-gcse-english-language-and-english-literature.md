# Edexcel GCSE English Language and English Literature

Banks: `edexcel-gcse-english-language`, `edexcel-gcse-english-literature`

Added 1 November 2026: `/question-bank/edexcel-gcse-english-language` and
`/question-bank/edexcel-gcse-english-literature`, every question from Pearson's GCSE English
Language (1EN0) and English Literature (1ET0) papers on its own site, June 2017 to June 2025
(Language June and November; Literature June, with November 2020 and 2021 in place of the
cancelled summers). Language: 240 questions from 30 papers. Literature: 459 questions and parts
from 20 papers. Every one has its mark scheme cropped with its full level descriptors; 223 and
407 have the examiner's comments. The same papers are in the library at
`/past-papers/gcse-english-language/edexcel` (120 files, with the source booklets) and
`/past-papers/gcse-english-literature/edexcel` (60). Scripts in
`scripts/question-bank/edexcel_gcse_english/` (fetch, cut_language, cut_literature, grids,
texts, build) and `scripts/past-papers/boards/edexcel_gcse_english.py`.

- **Language** is cut by `cut_pearson.py` itself (`--extracts`, so a long answer is its question,
  not its answer pages). Its sources are a booklet bound into each question paper (at the front
  until June 2018): `fetch_english.py` splits it out as the paper's insert
  (`edexcel/EDX-1EN0-01-INS-JUN24.pdf`), every reading question links to it ("Sources (insert)",
  which now also reads Pearson's "Text 1", "two texts" and "the writer"), and the cutter reads a
  copy without it. Paper 1's picture task carries the page of images under its crop. Topics are
  the papers' question slots (Paper 1 Q1 to Q4 and the imaginative writing pair, Paper 2 Q1 to
  7(b) and the transactional writing pair). Papers add up to 64 and 96, counting one writing task.
  November 2019's Paper 1 is set in outlines: read by OCR, its labels pinned in
  `labels/1en001-nov19.json`.
- **Literature** has its own question finder (`cut_literature.py`): the "Questions and Extracts
  Booklet" (bound after the answer pages from 2022), a question from its number to its total.
  Section A's Shakespeare and 19th-century novel questions are two parts, (a) on the extract and
  (b) on the whole text (`1et001-jun24-01-a`), and the extract is the stem they share; Paper 2's
  anthology questions carry the printed poem and the unseen question both poems as stems
  (`1et002-jun24-12-q`). Topics are the 25 set texts, the four anthology collections and unseen
  poetry (`texts.py`), read from each question's heading. Either/or: every question in a section
  after its first is an alternative, so Papers 1 and 2 add up to 80 (2N and 2P to 40).
- **Schemes** go through `cut_pearson`'s `ms_tables` and `carried()`. Each question's table runs on
  through the levels grids printed after it (Literature Paper 1 Section B's AO4 grid too).
  `grids.py` keeps a grid's level numbers ("0 | No rewardable material", "Level / 1") from reading
  as the next question's label, which had cut rows off before their levels, and reads the old
  schemes' "11. Blood" and "8 An" labels. Language's two writing tasks share the "Writing
  assessment grids" printed after the second; the first is given them too. November 2020's
  Literature 4(a), labelled "(a)" alone, is renumbered from the 3(b) before it.
- **Reports** head each question "Question 7", or "Question 7, An Inspector Calls" in the November
  series. Gaps: Literature Paper 1 June 2024 (no readable text), most of 2N November 2021, and a
  few November 2020 questions; Language Paper 2 June 2024 and a few of Paper 1's November 2023
  and 2024 questions.
- **Gaps:** November 2025 (Language) and June 2026 (both) are teachers only on Pearson's site.
- **R2:** crops under `bank/1en0*` and `bank/1et0*`; whole papers under `edexcel/EDX-1EN0-*` and
  `edexcel/EDX-1ET0-*`, sent by `scripts/past-papers/upload.py edexcel-gcse-english`.

```bash
python3 scripts/question-bank/edexcel_gcse_english/fetch_english.py lang
python3 scripts/question-bank/edexcel_gcse_english/fetch_english.py lit
python3 scripts/question-bank/edexcel_gcse_english/cut_language.py
python3 scripts/question-bank/edexcel_gcse_english/cut_literature.py
python3 scripts/question-bank/edexcel_gcse_english/build_english.py lang
python3 scripts/question-bank/edexcel_gcse_english/build_english.py lit
python3 scripts/past-papers/boards/edexcel_gcse_english.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-english-lang --crops-only
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-english-lit --crops-only
python3 scripts/past-papers/upload.py edexcel-gcse-english
```
