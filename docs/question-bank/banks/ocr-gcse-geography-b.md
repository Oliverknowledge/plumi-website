# OCR GCSE Geography B

Added 1 November 2026: `/question-bank/ocr-gcse-geography-b`, every question from OCR's GCSE (9-1)
Geography B (Geography for Enquiring Minds, J384) Papers 1-3 that OCR publishes on ocr.org.uk:
November 2021 and June 2022 to June 2025. That is 320 parts from 15 papers, every one with its own
mark scheme crop and tagged to a sub-question of the specification, and 256 with the examiner's
comments on its question (November 2021 has no reports).

- **Topics:** the specification's eight topics as tiles ("Global Hazards" … "Resource Reliance") with
  their enquiry sub-questions under them, coded as the specification numbers them ("1.1a Why do we
  have weather extremes?"), plus 9.1-9.4 Geographical Skills and fieldwork's six assessed areas
  (F1-F6, codes of our own, not shown). Paper 3 is synoptic: its parts take the content topic they
  draw on. A question's parts take the topic of the heading it is printed under
  (`tag_ocr_gcse_geography.py` rejects anything else). 7.2a (the UK's political role) has no
  questions yet.
- **Figures:** every paper prints its figures in a separate Resource Booklet ("Look at Fig. 3a in the
  Resource Booklet"). Each question's stem is its opening words and every booklet figure its parts
  name, read from the booklet caption to caption; a question set on the booklet as a whole, and
  Paper 3's 12-mark decision-making essay, has the whole booklet. Landscape pages are turned
  upright; June 2022 Paper 2's booklet is pictures and is read by OCR. The booklets are each
  sitting's insert (`ins`) in `wholes`.
- **Schemes:** `cut_ocr_gcse_geography.py` runs `ocr_gcse/cut_ocr_gcse.py` (and `cut_pearson.py`,
  both unchanged) with J384 patches: "(d*)" starred labels, sub-part romans set plain or past the
  "Question" header (June 2025 Paper 1), one-line rows 13pt apart, "4 (a) (i)" printed for a
  one-part 4(a). Each long answer's crop runs over pages with its levels and all of its indicative
  content, and stops at the scheme's appendix; the 15 SPaG questions show their own marks (`m`
  without the SPaG 3) and get the SPaG assessment grid added. `check_ocr_gcse_geography.py` checks
  every paper's total, levels and indicative content on every 6+ mark part, the SPaG grid, a stem
  wherever the booklet is named, and that every scheme crop opens on its own row: all 15 pass.
  48 of 49 multiple-choice parts carry their letter (`k`).
- **Gaps:** OCR's public page lists only November 2021 on; June 2018, June 2019 and November 2020 are
  on Teach Cambridge only (a June 2018 Paper 1 scheme is still on ocr.org.uk, but no paper). The
  modified papers and the sample assessment materials are left out. June 2022 Paper 1 had a choice
  of options (49 marks sat, 75 cut). No past paper library page yet; the whole papers are on R2
  under `ocr/OCR-J384-*`.

```bash
python3 scripts/question-bank/ocr_gcse_geography/fetch_ocr_gcse_geography.py
python3 scripts/question-bank/ocr_gcse_geography/spec_ocr_gcse_geography.py
python3 scripts/question-bank/ocr_gcse_geography/cut_ocr_gcse_geography.py
python3 scripts/question-bank/ocr_gcse_geography/check_ocr_gcse_geography.py
python3 scripts/question-bank/ocr_gcse_geography/tag_ocr_gcse_geography.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_gcse_geography/tag_ocr_gcse_geography.py merge
python3 scripts/question-bank/ocr_gcse_geography/build_ocr_gcse_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-geography/r2 --pdf-prefix=ocr/   # r2/img links to ../img
```
