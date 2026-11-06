# OCR GCSE Design and Technology

Added 5 November 2026: `/question-bank/ocr-gcse-design-and-technology`, every question from OCR's GCSE (9-1)
Design and Technology (J310) written paper, J310/01 Principles of Design and Technology, that OCR publishes on
ocr.org.uk with its mark scheme: November 2021 and June 2022 to June 2025. That is 170 questions and parts from
5 papers, every paper adding up to its 100 marks, every one with a mark scheme crop and a topic, and 138 with the
examiner's comments (November 2021 has no report). Asked for by a member on 1 November 2026 ("J310 is the spec
code and yeah if theres 2026 paper lmk").

- **June 2026 isn't there.** OCR's assessment page lists no June 2026 series (checked 5 November 2026: the
  newest is June 2025), and the specification's version 2.0 (June 2026) only rebrands to "Cambridge OCR" and adds NEA
  guidance, with no change to the paper. Re-run `fetch_ocr_gcse_dt.py` when OCR publishes it; `cut`, `tag split`
  (only the new parts), `tag merge` and `build` pick it up.
- **One paper.** J310/01 is 100 marks in two hours: Section A (questions 1 to 3, about 55 marks) is core
  principles set on pictures printed in the paper, with calculations, drawings (isometric and orthographic grids,
  a template to draw full size) and a 6 or 8-mark extended response; Section B (questions 4 to 6) works from the
  separate Insert. The other components (J310/02 and /03, the iterative design challenge) are non-exam
  assessment and aren't here.
- **The Insert as a stem.** Question 4 ("Refer to page 8 of the Insert", Images A to C) has that page as its
  stem. Questions 5 and 6 are set on "your chosen product": the student ticks one of six on page 15 (papers and
  boards, fibres and fabrics, design engineering, polymers, metals, timbers) and answers about it from its page
  of the Insert. The stem of every part of 5 and 6 is all six product pages, two to a row at half size, under
  the question's own opening words, and the scheme crop shows every product's answers as OCR prints them
  (OCR's scheme isn't split by product). November 2021's Insert prints grey "item removed due to third party
  copyright restrictions" boxes in place of some photographs; they are OCR's, left as published.
- **Answer space.** A part's crop runs from its label to its marks and keeps its ruled lines and answer boxes, as
  printed (`lib/questionSetPdf.ts` looks for them in a printed set); the 9 and 12-mark planning questions keep
  their sketch box. The page numbers, "Turn over", the section heading over question 4, the page where the student
  ticks a product, and "Question 5 (c) starts on Page 18" are left out of the crops.
- **Mark schemes:** each part's row of OCR's "Question | Answer | Mark | Guidance" table, across pages, with the
  levels-of-response grid for the extended responses and (5(c)(ii)) the table of specific techniques.
- **Examiner's reports:** June 2022 to June 2025, from OCR's reports by question.
- **Topics:** the specification's eight numbered sections as tiles and their 24 numbered enquiries ("5.2 What
  factors are important to consider when selecting appropriate materials...") under them, with the bank's short
  names (`TITLES` in `spec_ocr_gcse_dt.py`); 7.4 Digital design tools has no question tagged to it yet. The specification's maths and science appendices aren't topics:
  a calculation takes the topic of what it is about (quantities and cost `8.1`, a drawing to scale `4.1`).
- **Pipeline:** `scripts/question-bank/ocr_gcse_dt/`: `fetch_ocr_gcse_dt.py` (`ocr_gcse_classics`' fetcher over the
  J310 page, with the Insert as `ins`), `spec_ocr_gcse_dt.py`, `cut_ocr_gcse_dt.py` (`ocr_gcse/cut_ocr_gcse.py`
  unchanged, with the Insert stems and the region patches above; no shared script changed), `tag_ocr_gcse_dt.py` and
  `build_ocr_gcse_dt.py`. Whole papers, Inserts and schemes are on R2 at `ocr/OCR-J310-01-*`, crops at `bank/j31001-*`.
- **Not in the bank.** June 2018, June 2019 and November 2020 are on Teach Cambridge (OCR's teacher login) only.
  The modified papers (zips, redacted), the sample assessment materials and the NEA are left out. There is no
  D&T past-paper library page, so the bank has no library link. Only OCR's own site is used.

```bash
python3 scripts/question-bank/ocr_gcse_dt/fetch_ocr_gcse_dt.py
python3 scripts/question-bank/ocr_gcse_dt/spec_ocr_gcse_dt.py
python3 scripts/question-bank/ocr_gcse_dt/cut_ocr_gcse_dt.py
python3 scripts/question-bank/ocr_gcse_dt/tag_ocr_gcse_dt.py split   # then tag each batch (tag.md)
python3 scripts/question-bank/ocr_gcse_dt/tag_ocr_gcse_dt.py merge
python3 scripts/question-bank/ocr_gcse_dt/build_ocr_gcse_dt.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-dt/r2 --pdf-prefix=ocr/
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-dt --crops-only
npm run bank:data -- ocr-gcse-design-and-technology --verify
```
