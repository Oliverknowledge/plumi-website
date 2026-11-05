# AQA A-Level Further Maths

Added 1 November 2026: `/question-bank/aqa-a-level-further-maths`, every question from AQA's
A-Level Further Mathematics (7367) and, marked AS, AS Further Mathematics (7366), every
series from June 2019 (the first A-Level sitting): June 2019, November 2020 and 2021, June
2022 to June 2025. That is 682 questions from 63 papers (403 A-Level from 35 papers, 279 AS
from 28), each paper's questions adding up to its total (100 for Papers 1 and 2, 50 for
each Paper 3 option, 80 for AS Paper 1, 40 for each AS Paper 2 option), every one with
its mark scheme rows cropped, and every June question with the examiner's comments
(AQA wrote no reports for November).

- **Options:** Papers 1 and 2 (and AS Paper 1) are compulsory pure. Paper 3 (and AS
  Paper 2) is a paper per option, Mechanics, Statistics and Discrete, and a student takes
  two. Each option paper and topic section carries its option (`M`, `S`, `D`), and the
  bank's `options` are the three pairs ("Mechanics and Statistics", `takes: ["M", "S"]`):
  picking one keeps the compulsory papers and topics and the pair's. `BankOption.takes`
  is new; the option filter (`QuestionBank.tsx`) reads a pick as the options it takes,
  and a bank without `takes` (Eduqas Religious Studies, GCSE History) works as before.
- **Topics:** the specification's lettered sections: A Proof to J Numerical methods
  (compulsory), MA-ME Mechanics, SA-SH Statistics, DA-DG Discrete, under sections `Pure`,
  `Mech`, `Stats` and `Disc` (not letters: D is a topic). The AS specification uses the
  same codes for less content.
- **Cut** by `aqa_maths/cut_maths.py`, run through `cut_further_maths.py`, which adds:
  a question starts at the top of its label's line (many open with a matrix or vector
  standing above their label: the clipping AQA Level 2 Further Maths found; A-Level Maths
  probably has it too); the older schemes of Papers 1 and 2 (June 2019, November 2020)
  draw their tables further right, so a scheme label is one left of its own table's
  "Marking instructions" heading, not left of a fixed x (`MS_LABEL_X` and `MS_RULE_X`
  are new constants in `cut_maths.py`, at its old values, so 7357 is cut as before);
  and November 2020 Paper 2's question 5, labelled in plain type, is found as the gap
  between 4 and 6.
- **Year 12 / 13:** AS questions are Year 12; each A-Level question was read against the
  AS specification (`maths_years.py split-further`, AQA added): 176 Year 12, 227 Year 13.
- **Gaps:** none in the papers. June 2018 AS papers and the specimens are left out.

```bash
python3 scripts/question-bank/aqa_further_maths/fetch_further_maths.py
python3 scripts/question-bank/aqa_further_maths/spec_further_maths.py <AQA's 7367 specification PDF>
python3 scripts/question-bank/aqa_further_maths/cut_further_maths.py
python3 scripts/question-bank/aqa_further_maths/tag_further_maths.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_further_maths/tag_further_maths.py merge
python3 scripts/question-bank/aqa_further_maths/build_further_maths.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-further-maths --crops-only
```
