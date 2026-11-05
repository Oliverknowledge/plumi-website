# OCR GCSE Gateway Biology A, Chemistry A, Physics A and Combined Science A

Banks: `ocr-gcse-biology-a`, `ocr-gcse-chemistry-a`, `ocr-gcse-physics-a`, `ocr-gcse-combined-science-a`

`/question-bank/ocr-gcse-biology-a`, `-chemistry-a`, `-physics-a` and `-combined-science-a`, added
1 November 2026: every question from OCR's GCSE (9–1) Gateway Science Suite, Biology A (J247),
Chemistry A (J248), Physics A (J249) and Combined Science A (J250), Foundation and Higher, June 2018
to June 2025 with November 2020 and 2021 (8 series): 8,350 question parts from 192 papers (Biology A 1,636, Chemistry A 1,684, Physics A 1,619, Combined Science A 3,411), cut part by
part with their mark scheme rows and examiners' reports. 185 of the 192 papers add up to their
90 marks (60 for Combined Science A).

- **Papers and tiers:** the separate sciences have four papers, 1 and 2 Foundation, 3 and 4 Higher
  (Paper 3 is Paper 1's Higher partner, on the same topics); Combined Science A has twelve, 1 to 6
  Foundation (two each of Biology, Chemistry, Physics) and 7 to 12 Higher in the same order. Papers keep
  OCR's numbers and say their tier ("Paper 3 Higher", "Chemistry Paper 9 Higher"), and a Foundation
  paper's id is its Higher partner's with the last letter changed (`j2471f`/`j2471h`,
  `j250c1f`/`j250c1h`), so `tiers.py` pairs them for "Both-tier questions once".
- **Source papers:** OCR's own site only. `fetch_ocr_gcse.py` reads each specification's assessment
  page with the past paper library's reader (`scripts/past-papers/boards/ocr.py`), adding the J250
  page the library doesn't list. Two report links serve another sitting's file (J247/02 June 2024,
  J249/03 November 2020) and are left out. J247-J249 whole papers are the library's R2 copies under
  `ocr/`; J250's were uploaded there under the same names (`ocr/OCR-J250-07-QP-JUN23.pdf`). Crops
  are under `bank/`.
- **Topics:** OCR's topics (B1 Cell level systems …) are the tiles and its sub-topics (B1.1 Cell
  structures …) the topics, read from the four specification PDFs by `spec_ocr_gcse.py`. The practical
  skills topic is left out; practical questions take the content they test. Combined Science A's three
  "Global challenges" name their science.
- **Cutting:** `cut_ocr_gcse.py` runs `cut_pearson.py` (the OCR A-Level cutter and its scheme reader,
  which keeps a row carried over a page whole, guidance column included) with GCSE-only patches, so no
  other bank's crops move: the page number printed at the top of each page sits inside the cutter's
  margin, so a page's frame starts below it; a few scheme rows set their part letters in plain type
  (Physics Paper 2 June 2018); Combined Science Paper 9 November 2020 sits 8pt further right; an empty
  ruled table at the end of a scheme is left off the last row's crop.
- **Scans:** five November 2020 Combined Science A papers (Papers 1, 3, 4, 5 and 11) are scans. Vision
  misses their margin question numbers, so `margin_numbers` reads each page's number column glyph by
  glyph, and only the parts whose scheme row is found are kept: 156 parts of the five papers'
  roughly 180 (Biology Paper 1 has 21 of 36, Physics Paper 11 24 of 30; the rest 36 to 38). Vision's "12]"
  reads as the "[2]" it is. Scanned crops keep the scan's look.
- **November 2021:** OCR printed these papers but no one sat them; their schemes are drafts, "not used
  for marking". They are in, as OCR publishes them.
- **Tags:** every part was tagged by Claude following `tag.md` ("OCR GCSE Gateway sciences").
- **Practicals:** judged as for the other science banks (`practicals.py`).

Gaps, honestly:
- The five scanned November 2020 papers are partial (above), and a few of their marks and of two typeset
  papers' (Physics Paper 2 June 2024, Combined Science Paper 12 June 2025) didn't read, so those parts
  show no mark count: 15 parts in all.
- 13 parts (0.2%) link to the whole mark scheme instead of a cropped row; `ms_fallback.py` gave 44 more
  their rows.
- The past paper library doesn't list Combined Science A (J250); its whole papers are on R2 but only the
  bank links to them. And two of OCR's report links that the library uses serve the wrong sitting's
  report (above); the library's own copies still do.
- Foundation and Higher papers share questions, so those appear twice, once per tier, and
  `tiers.json` lists the pairs (Biology A 166, Chemistry A 187, Physics A 161, Combined Science A 392 Foundation parts).
- June 2026 isn't public on OCR's site yet.

```bash
python3 scripts/question-bank/ocr_gcse/fetch_ocr_gcse.py
python3 scripts/question-bank/ocr_gcse/spec_ocr_gcse.py
python3 scripts/question-bank/ocr_gcse/cut_ocr_gcse.py           # --only=j2471h-jun26 for one paper
python3 scripts/question-bank/ocr_gcse/tag_ocr_gcse.py split     # tag the new batches, then:
python3 scripts/question-bank/ocr_gcse/tag_ocr_gcse.py merge
python3 scripts/question-bank/ocr_gcse/build_ocr_gcse.py
python3 scripts/question-bank/tiers.py ocr-gcse-biology-a ocr-gcse-chemistry-a ocr-gcse-physics-a ocr-gcse-combined-science-a
python3 scripts/question-bank/practicals.py split --only=ocr-gcse-biology-a,ocr-gcse-chemistry-a,ocr-gcse-physics-a,ocr-gcse-combined-science-a --parts=scripts/question-bank/.work/ocr-gcse/parts.json   # judge, then merge with the same --only
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse --crops-only
```
