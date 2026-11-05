# OCR GCSE Twenty First Century Science: Biology B, Chemistry B, Physics B and Combined Science B

Banks: `ocr-gcse-biology-b`, `ocr-gcse-chemistry-b`, `ocr-gcse-physics-b`, `ocr-gcse-combined-science-b`

`/question-bank/ocr-gcse-biology-b`, `-chemistry-b`, `-physics-b` and `-combined-science-b`, added
5 November 2026, when a member asked for "OCR 21st century" combined and triple science: every question
from OCR's GCSE (9–1) Twenty First Century Science suite, Biology B (J257), Chemistry B (J258), Physics B
(J259) and Combined Science B (J260), Foundation and Higher, June 2018 to June 2025 with November 2020 and
2021 (8 series): 7,069 question parts from 159 papers (Biology B 1,448, Chemistry B 1,562, Physics B 1,375,
Combined Science B 2,684), cut part by part with their mark scheme rows and examiners' reports, every part
tagged to a topic, 682 marked practical (100, 153, 161, 268). 157 of the 159 papers add up to their marks
(90 for J257–J259, 95 for J260's Biology, Chemistry and Physics papers, 75 for its Combined science paper).
The Gateway banks' sibling pipeline (`ocr_gcse/`) is the model; this is a close copy with a new topic reader,
new paper ids and a cutter that copes with picture pages (below).

- **Papers and tiers:** the separate sciences have four papers: 1 and 2 Foundation, 3 and 4 Higher, OCR's
  "Breadth in" (1, 3) and "Depth in" (2, 4) the subject, shown as the paper's title ("Paper 3 Higher ·
  Breadth in biology"). Combined Science B has eight: 1 to 4 Foundation (Biology, Chemistry, Physics and
  the mixed Combined science paper), 5 to 8 Higher in the same order ("Chemistry Paper 6 Higher").
  A Foundation paper's id is its Higher partner's with the last letter changed (`j2571f`/`j2571h`,
  `j260cf`/`j260ch`), so `tiers.py` pairs them for "Both-tier questions once" (143, 165, 129 and 265
  Foundation parts).
- **Source papers:** OCR's own site only: `fetch_ocr_gcse_b.py` reads each specification's assessment page
  with the past paper library's reader, adding the J260 page the library doesn't list. Every PDF was
  checked for the code and year printed inside it. J257–J259's whole papers are the library's copies on R2
  under `ocr/`; J260's 175 files were uploaded under the same names (`upload_wholes_ocr_gcse_b.py`).
  Crops are under `bank/`.
- **Topics:** OCR's chapters (B1 You and your genes …) are the tiles and its topics (B1.2 How is genetic
  information inherited?) the topics, read from the four specification PDFs by `spec_ocr_gcse_b.py`
  (28, 26, 25 and 66 topics). Ideas about Science (B7, C7, P7) and Practical skills (B8, C8, P8) have no
  topic of their own; those questions are tagged to the content they test. "(separate science only)" is
  dropped from titles.
- **Cutting:** `cut_ocr_gcse_b.py` is the Gateway cutter (`cut_pearson.py` with OCR GCSE patches) plus:
  - **Picture pages.** Whole papers' worth of November 2020 pages, and the odd page of other papers, are
    pictures with no text layer, read by Vision. Vision often misses a question's number alone in the
    margin, so those questions' parts ran into the question before (Biology B June 2022 Higher's last six
    questions were one). `picture_numbers` finds each number's glyph from the page's pixels and numbers it,
    unless the numbers the paper does print say none is missing (a graph's axis figures sit in the same
    column), the glyph is taller than a digit (J260's part labels "(c)" sit in the number column) or no
    question text follows it on its line (a drawing's edge).
  - **"Section A".** The cutter stops a part at a line reading "SECTION A" in any case; a graph's
    "Section A" and "Section B" tick boxes (Biology B June 2024, Physics B June 2019) cut the part short,
    losing its boxes and marks. Only upper case counts now.
  - **Margin from table figures.** The cutter took a paper's left margin from the smallest number alone on
    a line, which in 24 papers was a table's figures, not a question number, so their questions
    were merged and cut short. Only numbers within 62pt of the edge count.
  - These changes are in `cut_ocr_gcse_b.py` only; no other bank's crops move.
- **Marks read by hand:** 10 parts' marks Vision couldn't read were read off the paper and scheme into
  `scripts/question-bank/labels/<set>.json` (j2581h-jun24, j2592f-nov20, j260bf-jun24, j260bh-jun22,
  j260bh-nov20, j2572f-jun22, j2581f-jun23).
- **Tags:** every part was tagged by Claude following `tag.md` ("OCR GCSE Twenty First Century sciences",
  `tag/ocr-gcse-21c-sciences.md`). The specification has no topic for gears and moments, the carbon cycle,
  seismic waves or the particle model in Chemistry B, so those parts take the nearest topic (P4.1, B3.3,
  P1.3/P1.4, C4.2). **Practicals:** judged as for the other science banks (`practicals.py`).

Gaps, honestly:
- **J260/08 June 2025** (Combined Science B Higher, Paper 8): OCR's link for the question paper serves the
  J260/06 Chemistry paper, byte for byte, so the paper is out of the bank (its scheme and report are on
  OCR's site but there are no questions to attach them to). OCR's own link to correct is a question for OCR;
  a mirror's copy would be Daniel's call.
- J257/04 June 2024's examiners' report link serves Gateway's report (the library already leaves it out), so
  those questions have no report. No examiners' reports are published for November 2020 and 2021.
- Two papers' marks don't add up: Combined Science B Biology Paper 5 Higher November 2020 reads 92 of 95 and
  Physics B Paper 2 Foundation November 2020 89 of 90, where a picture page's "[2]" didn't read.
- 74 parts (1.0%) link to the whole mark scheme instead of a cropped row (11, 20, 18 and 25 by bank);
  `ms_fallback.py` can give more of them their rows.
- A few parts whose answer is printed words (a sentence to complete) run straight on to the next label, and
  the page break between them puts the answer line in the next part's crop (Biology B June 2022 6(b)(i),
  Chemistry B June 2023 3(b), Combined Science B June 2022 5(e)(ii)); three in all.
- Foundation and Higher papers share questions, so those appear twice, once per tier; `tiers.json` lists
  the pairs. November 2021 papers were printed but not sat; their schemes are OCR's drafts.
- The library has no J260 page; only the bank links to its whole papers. June 2026 isn't public yet.
- Physics B has one part fewer than the cut (1,375 of 1,376): a label read twice on one page gave two parts one
  id, and the builder leaves both out.

```bash
python3 scripts/question-bank/ocr_gcse_b/fetch_ocr_gcse_b.py
python3 scripts/question-bank/ocr_gcse_b/spec_ocr_gcse_b.py
python3 scripts/question-bank/ocr_gcse_b/cut_ocr_gcse_b.py            # --only=j2571h-jun25 for one paper
python3 scripts/question-bank/ocr_gcse_b/tag_ocr_gcse_b.py split      # tag the batches, then:
python3 scripts/question-bank/ocr_gcse_b/tag_ocr_gcse_b.py merge
python3 scripts/question-bank/ocr_gcse_b/build_ocr_gcse_b.py
python3 scripts/question-bank/tiers.py ocr-gcse-biology-b ocr-gcse-chemistry-b ocr-gcse-physics-b ocr-gcse-combined-science-b
python3 scripts/question-bank/practicals.py split --only=ocr-gcse-biology-b,ocr-gcse-chemistry-b,ocr-gcse-physics-b,ocr-gcse-combined-science-b --parts=scripts/question-bank/.work/ocr-gcse-b/parts.json   # judge, then merge with the same --only
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-b --crops-only
python3 scripts/question-bank/ocr_gcse_b/upload_wholes_ocr_gcse_b.py
python3 scripts/question-bank/upload_data.py ocr-gcse-biology-b ocr-gcse-chemistry-b ocr-gcse-physics-b ocr-gcse-combined-science-b
```
