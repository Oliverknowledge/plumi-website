# OCR GCSE Economics

Added 2 November 2026: `/question-bank/ocr-gcse-economics`, every question from OCR's GCSE (9-1)
Economics (J205) Paper 1 (Introduction to economics) and Paper 2 (National and international
economics) that OCR publishes on ocr.org.uk: November 2021 and June 2022 to June 2025. That is 379
parts from 10 papers, every one with its own mark scheme crop and tagged to a topic of the
specification, and 163 questions with the examiner's comments (November 2021 has no reports).

- **Topics:** the specification's 22 topics in its four sections, coded as it numbers them ("2.3
  Supply", "4.2 Balance of payments"). Paper 1 tests sections 1 and 2, Paper 2 sections 3 and 4.
- **Section A:** twenty multiple-choice questions a paper. Each carries its letter (`k`) as well as
  its row of the scheme's key table, all 199 checked against OCR's tables.
- **Section B:** three questions a paper, each opening with an extract (text, a table or a graph),
  then (a) to (d)(iii). Every part shows its question's extract as its stem.
- **Cutting:** `cut_ocr_gcse_economics.py` runs `ocr_economics/cut_ocr_economics.py` (and
  `cut_pearson.py`, both unchanged) with J205 patches: an "Extract 1" heading belongs to its
  question, a part ends at its marks line (and its answer box), the page footer is painted out of
  crops, scheme labels split as "(d)" over or beside "(i)" are read as one, the assessment-objective
  grid at a scheme's back is left out, and a row's last cell carried over a page goes back to it.
- **Gaps:** OCR's public page lists only November 2021 on; June 2019 and November 2020 are on Teach
  Cambridge only. June 2022 Paper 1's question 17 is left out: OCR withdrew it after the exam (a
  post-exam correction, every candidate given the mark). The modified papers and the sample
  assessment materials are left out. No past paper library page yet; the whole papers are on R2
  under `ocr/OCR-J205-*`.

```bash
python3 scripts/question-bank/ocr_gcse_economics/fetch_ocr_gcse_economics.py
python3 scripts/question-bank/ocr_gcse_economics/spec_ocr_gcse_economics.py
python3 scripts/question-bank/ocr_gcse_economics/cut_ocr_gcse_economics.py
python3 scripts/question-bank/ocr_gcse_economics/tag_ocr_gcse_economics.py split   # then tag each batch (tag.md)
python3 scripts/question-bank/ocr_gcse_economics/tag_ocr_gcse_economics.py merge
python3 scripts/question-bank/ocr_gcse_economics/build_ocr_gcse_economics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-economics/r2 --pdf-prefix=ocr/
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-economics --crops-only
```
