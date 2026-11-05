# Edexcel GCSE Computer Science

Added 30 October 2026, after a student asked: `/question-bank/edexcel-gcse-computer-science`
(Pearson Edexcel GCSE (9-1) Computer Science, 1CP2), on the GCSE shelf, and its past paper
library page `/past-papers/gcse-computer-science/edexcel`. Every file is Pearson's own, from
qualifications.pearson.com. Whole papers and code files are on R2 under the library's names
(`edexcel/EDX-1CP2-01-QP-JUN24.pdf`, `edexcel/EDX-1CP2-02-DATA-JUN24.zip`), the crops under
`bank/1cp21*` and `bank/1cp22*`.

- **210 parts** from 10 papers: Paper 1 (Principles of Computer Science) and Paper 2
  (Application of Computational Thinking) for June 2022 to June 2025 and the sample
  assessment materials. Every paper adds up to its 75 marks, every part has its own scheme
  crop, the 18 multiple-choice parts show their answer letter, and every question from a
  live series has the examiner's comments on it.
- **Paper 2 is sat on screen, in Python.** Each of its six questions ("Open file Q03.py",
  amend or write the program) is one whole question here, with its scheme: the marking
  points, the levels grids and Pearson's model program (printed as pictures). Beside each
  question is "The code files (zip)", the sitting's Q01.py to Q06.py and data files. Pearson
  keeps June 2025's code files for teachers only, so those questions have none; the bank
  page says so.
- **Topics:** the specification's 66 numbered points (`2.1.3` Converting denary and binary,
  `4.1.5` Network speed calculations, `6.4.2` Reading and writing files), with short titles
  written for them, under its 20 headings (`1.2 Algorithms`, `6.4 Input and output`).
  Paper 1 is tagged to Topics 1 to 5, Paper 2 to Topic 6.
- **Library:** both papers, every sitting, with question paper, mark scheme and examiner's
  report, the specimen (Pearson's sample assessment book for each paper, split into its
  question paper and mark scheme), and Paper 2's code files under "More" (June 2022 to
  2024 and the specimen). The library's `data` kind and its "Code files" link are new.
- **Pipeline:** `scripts/question-bank/edexcel_cs/`: `fetch_cs.py` (Pearson's search index,
  as `boards/edexcel.py`), `spec_cs.py`, `cut_cs.py` (cut_pearson.py as a library; Paper 2's
  schemes are cut by their pages, its reports' "Q01 – …" headings read), `tag_cs.py` (tag.md's
  Edexcel GCSE Computer Science section) and `build_cs.py`. The library's
  `scripts/past-papers/boards/edexcel_cs.py` runs the same fetch. Two marks the cutter
  misreads are set in `scripts/question-bank/labels/1cp21-jun22.json` and `1cp21-jun25.json`.
- **Gaps:** June 2026 and June 2025's code files are for teachers only on Pearson's site.
  1CP2 was first sat in June 2022; there is no November series.

```bash
python3 scripts/question-bank/edexcel_cs/fetch_cs.py
python3 scripts/question-bank/edexcel_cs/spec_cs.py
python3 scripts/question-bank/edexcel_cs/cut_cs.py
python3 scripts/question-bank/edexcel_cs/tag_cs.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_cs/tag_cs.py merge
python3 scripts/question-bank/edexcel_cs/build_cs.py
python3 scripts/past-papers/boards/edexcel_cs.py && python3 scripts/past-papers/build.py
python3 scripts/past-papers/upload.py edexcel-cs
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-cs --crops-only --checksum
```
