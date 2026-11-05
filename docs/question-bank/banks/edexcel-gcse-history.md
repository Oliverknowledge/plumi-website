# Edexcel GCSE History

Added 1 November 2026: `/question-bank/edexcel-gcse-history`, every question from Pearson Edexcel's
GCSE (9-1) History (1HI0) that Pearson publishes on qualifications.pearson.com: June 2018, June 2019,
November 2020, November 2021 and June 2022 to June 2025. That is 637 parts from 128 option papers, every
one with its own mark scheme crop and tagged to a key topic; 210 carry their sources or interpretations
as a stem and 583 the examiner's comments on their question.

- **Options.** Every option is a paper of its own, as Pearson codes them: Paper 1's thematic study and
  historic environment, Options 10 to 13 (13, Migrants in Britain, first sat in 2022); Paper 2's period
  studies P1 to P5 and British depth studies B1 to B4; Paper 3's modern depth studies 30 to 33. The bank
  uses the `options` filter as Eduqas GCSE History does, labelled **Study** (thematic, period, British
  depth, modern depth, `?option=period`); a student picks their own four options under Paper. November
  2021 and June 2022 were set as 1HIA (the same options): filed under 1hi0 with the rest. November 2021
  sat only some options.
- **June 2018's Paper 2** set a period study (Section A) and a British depth study (Section B, EITHER
  Question 4 OR Question 5) in one paper, a code for each pairing (20 to 29). Each study is filed under
  the option paper sat since 2019 (P1 to P5, B1 to B4), keeping its printed numbers ("4(c)(ii)"); the
  repeats in the other pairings (the same questions, checked) are left out, and the whole-paper links
  go to the paired paper.
- **Sources.** Papers 1 and 3 print their sources and interpretations in a Sources (or
  Sources/Interpretations) Booklet bound in after the paper. Each source and interpretation is cut on
  its own, from its heading ("Source B:", "Interpretation 1:") to the next, and a question carries the
  ones its parts name as its stem ("Study Sources B and C", "both interpretations"). Paper 3's Source A,
  printed in the paper under "Study Source A below", is Question 1's stem; its id ends `-q`.
- **Crops.** Answers are written in the paper, so a part runs from its first line to its last: the
  dotted answer lines are whited out and the gaps closed up; the tables to complete (Paper 1's 2(b),
  Paper 3's Question 1) stay. The paper's furniture is left out (the boxes to mark a choice, "Answer
  EITHER…", the SPaG notice, section totals).
- **Schemes.** Read by `cut_pearson.py --figures` (unchanged) through `cut_gcse_history.py`. Every
  long answer's scheme is a levels grid whose "1" to "4" sit in the Question column: a bare number with a
  mark range beside it is read as a level, not a question, and the SPaG grid's wrapped "Performanc / e"
  header is no label. Every 8- to 16-mark crop runs from its question's row through its levels grid
  (and SPaG grid) to the end of its indicative content, over pages. `check_gcse_history.py` checks that
  every paper's parts add up to its printed total (SPaG left out, one of each choice) and that each
  part has its scheme: all 128 pass.
- **Marks and choices.** A part's marks are its own; SPaG is in the scheme crop. Paper 2's "Explain two
  of the following" (three choices, 8 marks each) is one 16-mark question. The second of a choice
  (Paper 1's Question 5 OR 6, Paper 2's 1(c)(i) OR (ii)) is marked `or`: 64 parts.
- **Reports.** June 2024's reports set their text in fonts with no character map, so they are read by
  OCR, as Geography B's are. June 2022's head each question "Q1 Introduction", "Q3-2 Commentary".
- **Tags.** Claude subagents tagged every part following `tag.md`'s "Edexcel GCSE History" section,
  one batch per option. Paper 1's Section A (Questions 1 and 2) is always the historic environment and
  is tagged by the script.
- **Gaps:** June 2026 is for teachers only. Pearson didn't write reports for some small autumn
  entries ("Pearson will not publish an Examiner's Report for this paper": November 2020 Options 32, B2,
  P1, P2, P5; November 2021 Options 12, 30, 33, B1, B2, B3), November 2021 P4's is written without
  per-question headings, and June 2022 P2's has none for Question 3: 54 parts have no comments. The specimen papers are left out, as for the other
  banks. No past paper library page yet: the whole papers are on R2 under `edexcel/1hi0-*`.

```bash
python3 scripts/question-bank/edexcel_gcse_history/fetch_gcse_history.py
python3 scripts/question-bank/edexcel_gcse_history/spec_gcse_history.py
python3 scripts/question-bank/edexcel_gcse_history/cut_gcse_history.py
python3 scripts/question-bank/edexcel_gcse_history/check_gcse_history.py
python3 scripts/question-bank/edexcel_gcse_history/tag_gcse_history.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_gcse_history/tag_gcse_history.py merge
python3 scripts/question-bank/edexcel_gcse_history/build_gcse_history.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-history --pdf-prefix=edexcel/
```
