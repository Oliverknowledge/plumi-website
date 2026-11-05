# AQA GCSE Computer Science

Added 1 November 2026: `/question-bank/aqa-gcse-computer-science` (AQA GCSE Computer Science,
8525), on the GCSE shelf. Every file is AQA's own, from the specification's assessment
resources page. Whole papers are on R2 under AQA's names (`aqa/AQA-85251B-QP-JUN24.pdf`,
`aqa/AQA-85251-MS-JUN24.pdf`), the crops under `bank/85251*` and `bank/85252*`.

- **740 parts** from 20 papers: Paper 1 (Computational thinking and programming skills) in
  each of its three languages, 8525/1A C#, 1B Python and 1C VB.NET, and Paper 2 (Computing
  concepts), for June 2022 to June 2025 and the specimen papers. Every paper adds up to its
  90 marks, every part has its own scheme crop, and 587 of the 601 parts from live series
  have the examiner's comments on their question.
- **Language filter.** Paper 1 is a paper per language, and the bank's "Language" option
  (the mechanism Eduqas Religious Studies sorts its religions by) keeps the language picked
  and Paper 2. AQA writes one Paper 1 mark scheme for all three languages, with model answers
  in each in turn ("C# Example 1 (fully correct)", "Python Example 1 …"): each language's
  scheme crops keep the marking points and that language's examples only.
- **Topics:** the 2020 specification's numbered headings (`3.2.6` Data structures, `3.6.2.1`
  Social engineering), with 3.5 (networks, unnumbered) split into `3.5a` to `3.5e` and 3.8 as
  one topic: 41 topics under its eight areas. AQA's page now lists the specification for
  exams from 2027, which has the same headings but drops star and bus topologies, optical
  storage and the Ethernet, Wi-Fi, UDP and FTP protocols.
- **Pipeline:** `scripts/question-bank/aqa_gcse_cs/`: `fetch_gcse_cs.py` (fetch_aqa.py over
  8525; Paper 1's shared scheme and report listed under each language), `spec_gcse_cs.py`,
  `cut_gcse_cs.py` (computer_science/cut_aqa_cs.py imported unchanged; reads the schemes'
  "Question | Part" columns and keeps each language's own examples), `tag_gcse_cs.py` (tag.md's
  AQA GCSE Computer Science section; only the Python paper is tagged, its tags copied to C#
  and VB.NET) and `build_gcse_cs.py`.
- **Notice pages (November 2026):** 10 question crops held a whole "do not write" page, and two specimen crops AQA's
  copyright notice too (`cut.py`'s fix, re-cut with `cut_gcse_cs.py`). Marks and every other word stayed. `85252-jun25-20-3`
  differed only in spacing and was left alone.
- **Left out:** AQA's second Paper 2 specimen, for exams from 2027 (37 of its 40 parts are the
  2020 specimen's word for word); the modified (enlarged) papers; and the old specification
  (8520), of which AQA still hosts only November 2021's two papers.

```bash
python3 scripts/question-bank/aqa_gcse_cs/fetch_gcse_cs.py
python3 scripts/question-bank/aqa_gcse_cs/spec_gcse_cs.py
python3 scripts/question-bank/aqa_gcse_cs/cut_gcse_cs.py
python3 scripts/question-bank/aqa_gcse_cs/tag_gcse_cs.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_cs/tag_gcse_cs.py merge
python3 scripts/question-bank/aqa_gcse_cs/build_gcse_cs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-cs
```
