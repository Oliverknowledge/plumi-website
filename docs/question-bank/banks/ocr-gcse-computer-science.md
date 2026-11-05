# OCR GCSE Computer Science

Added 1 November 2026: `/question-bank/ocr-gcse-computer-science` (OCR GCSE (9-1) Computer
Science, J277), on the GCSE shelf. Every file is OCR's own, from ocr.org.uk. Whole papers are
on R2 under the library's naming (`ocr/OCR-J277-01-QP-JUN24.pdf`, `ocr/OCR-J277-02-MS-SPEC.pdf`),
the crops under `bank/j27701*` and `bank/j27702*`.

- **282 parts** from 10 papers: J277/01 (Computer systems) and J277/02 (Computational
  thinking, algorithms and programming) for June 2022 to June 2025 (225 parts) and OCR's
  sample assessment materials (57). Every paper adds up to its 80 marks, every part has its
  own scheme crop, and every part from a live series has the examiner's comments on its
  question.
- **Topics:** the specification's 25 numbered sub topics (`1.1.1` Architecture of the CPU,
  `2.1.3` Searching and sorting algorithms) under its 11 topics (`1.3` Computer networks,
  connections and protocols). 1.2.4 Data storage, which the specification sets under four
  headings of its own, is four topics here: `1.2.4a` numbers (binary, hexadecimal, shifts),
  `1.2.4b` characters, `1.2.4c` images and `1.2.4d` sound. Paper 1 is tagged to 1.x, Paper 2
  to 2.x.
- **Pipeline:** `scripts/question-bank/ocr_gcse_cs/`: `fetch_ocr_gcse_cs.py` (OCR's
  assessment page, read with `computer_science/fetch_ocr_cs.py`; the sample papers, one PDF
  each, split into question paper and scheme), `spec_ocr_gcse_cs.py`, `cut_ocr_gcse_cs.py`
  (`computer_science/cut_ocr_cs.py` and `cut_pearson.py` as libraries, unchanged; its
  docstring lists what J277 sets differently: a mark just above the next label, a scheme
  label run into its answer, the reports' "Question 6*" headings, the sample papers' wider
  margin), `tag_ocr_gcse_cs.py` (tag.md's OCR GCSE Computer Science section) and
  `build_ocr_gcse_cs.py`. June 2025 Paper 2's scheme numbers question 3(a) "3(a)(i)": set in
  `scripts/question-bank/labels/j27702-jun25.json`.
- **Gaps:** J277 was first sat in June 2022, with no November series. Its predecessor J276
  (first taught 2016) is left out: OCR's J276 page no longer lists any papers (they are on
  Teach Cambridge, for teachers), and J276 numbers its content differently and assessed
  programming by a project, not in Paper 2's Section B, so its questions don't map cleanly
  onto J277's topics. The modified papers are left out. June 2026 isn't on OCR's public
  page yet.

```bash
python3 scripts/question-bank/ocr_gcse_cs/fetch_ocr_gcse_cs.py
python3 scripts/question-bank/ocr_gcse_cs/spec_ocr_gcse_cs.py
python3 scripts/question-bank/ocr_gcse_cs/cut_ocr_gcse_cs.py
python3 scripts/question-bank/ocr_gcse_cs/tag_ocr_gcse_cs.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_gcse_cs/tag_ocr_gcse_cs.py merge
python3 scripts/question-bank/ocr_gcse_cs/build_ocr_gcse_cs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-cs --crops-only --checksum
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-cs/r2 --pdf-prefix=ocr/ --checksum   # (needs an empty r2/img)
```
