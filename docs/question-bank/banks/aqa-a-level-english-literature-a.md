# AQA A-Level English Literature A

`/question-bank/aqa-a-level-english-literature-a`: every question from AQA's A-Level (7712:
Paper 1 Love through the ages, Paper 2A WW1 and its aftermath, Paper 2B Modern times) and AS
(7711, Papers 1 and 2) English Literature A papers AQA still publishes, November 2020 to June
2025: 303 questions from 28 papers, every one with its mark scheme cropped and 199 with the
examiner's comments. The same scripts with `--level=a`; topics are the set texts again, under
Love through the ages, WW1 and its aftermath and Modern times, with unseen poetry, unseen prose,
comparing texts and each Paper 2's contextual linking as topics of their own.

- **Options.** Paper 2A and 2B offer three options (a poetry, drama or prose set text), each
  a Section A on the set text and a Section B of two questions on an unseen prose extract
  printed in the insert. A student answers one option, so options 2 and 3 carry `or` whole,
  and every paper adds up to 75 (AS: 50). The three options print the same Section B, so its
  two questions appear three times (05/06, 11/12, 17/18), each tagged to that paper's
  contextual linking topic. Section B's ids are `77122a-jun24-b-05`, and their stem is the
  section's introduction and the insert's extract (`77122a-jun24-b-stem.webp`).
- **Questions** print the question before the extract (Shakespeare) or the poems (unseen
  poetry, the AS anthology), and the crop carries both.
- **Mark schemes:** each question's indicative content, starting at its "Question" line,
  then the one levels grid printed for every question. Section B's scheme serves all three
  options ("Questions 05, 11 and 17").
- **Reports** head each question ("Question 1 Othello", "Questions 5, 11, 17"), and each
  question gets its own; questions a report covers only under its text's heading get that.
- **Gaps:** AQA no longer publishes 2017–2019 (or AS 2016–2019). There are no reports for
  November 2020 and 2021, or for AS Paper 2 June 2024, and the June 2025 Paper 2B report
  skips 6 questions. AQA's copies withhold some extracts for copyright, and the crops show
  AQA's note: the Paper 2 insert for November 2021 (2A and 2B), June 2022 (2B: Peyton
  Place, with page references) and June 2025 (2B), and one unseen poem each in Paper 1 June
  2023 and November 2021. Specification B is its own bank, below.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py a-level
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=a
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py --level=a
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-a
```
