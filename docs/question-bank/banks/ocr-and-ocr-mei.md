# OCR and OCR MEI

Banks: `ocr-a-level-biology-a`, `ocr-a-level-chemistry-a`, `ocr-a-level-physics-a`, `ocr-a-level-maths`, `ocr-a-level-further-maths`, `ocr-mei-a-level-maths`, `ocr-mei-a-level-further-maths`

Added 25 October 2026, after the bank's video went viral and students asked for OCR:

| Bank | Specifications | Unit |
| --- | --- | --- |
| `/question-bank/ocr-a-level-biology-a` | H420, AS H020 | part |
| `/question-bank/ocr-a-level-chemistry-a` | H432, AS H032 | part |
| `/question-bank/ocr-a-level-physics-a` | H556, AS H156 | part |
| `/question-bank/ocr-a-level-biology-b` | Biology B (Advancing Biology) H422, AS H022 | part |
| `/question-bank/ocr-a-level-chemistry-b` | Chemistry B (Salters) H433, AS H033 | part |
| `/question-bank/ocr-a-level-physics-b` | Physics B (Advancing Physics) H557, AS H157 | part |
| `/question-bank/ocr-a-level-maths` | H240, AS H230 | whole question |
| `/question-bank/ocr-a-level-further-maths` | H245 (Y540-Y545), AS H235 | whole question |
| `/question-bank/ocr-mei-a-level-maths` | H640, AS H630 | whole question |
| `/question-bank/ocr-mei-a-level-further-maths` | H645 (Y420-Y436), AS H635 | whole question |

Sciences run June 2016 (AS) / 2017 (A-Level) to June 2025; maths June 2018 to June
2025 (A-Level Further Maths from June 2019). OCR keeps the newest series on Teach
Cambridge, for teachers, so June 2026 arrives a year late.

- **Papers:** the past paper library's OCR fetcher (`scripts/past-papers/boards/ocr.py`)
  already downloads every OCR paper. `ocr/fetch_ocr.py` (and `--maths`) copies the
  ones the bank needs from its work folder, and the bank's "whole paper" links are the
  library's own R2 keys (`ocr/OCR-H432-01-QP-JUN24.pdf`), so nothing is stored twice.
- **Topics:** sciences from OCR's specifications (`ocr/spec_ocr.py`): sections ("3.1
  The periodic table") as tiles and numbered topics ("3.1.2 Group 2") under them, Year
  1 = Modules 2-4. Maths uses the Edexcel maths bank's topics (`edexcel_topics.json`):
  A-Level Maths content is the same for every board.
- **Cutting:** `edexcel_sciences/cut_pearson.py` reads OCR's layout too: marks printed
  "[3]", scheme labels split across columns ("16" | "(a)" | "(i)", or bare "a" | "i"),
  "(ii)" rows carrying on the part above, a multiple-choice table under one header.
  Maths is cut with `--whole`: a question at a time with all its scheme rows.
- **Tagging:** `ocr/tag_ocr.py` (sciences) and `ocr/maths_ocr.py split|merge` (maths),
  briefed by tag.md's OCR section.
- **Building:** `ocr/build_ocr.py` and `ocr/maths_ocr.py build`.

Gaps, after the fixes of 25 October 2026 (below): every OCR science paper's marks
add up exactly, and every Maths paper's too. OCR publishes no mark scheme for Maths
H240/01 June 2018 or MEI Further Maths Y433/01 June 2023, so those 19 questions link
none. 38 science parts and 2 maths questions still link the whole scheme instead of a
cropped row, where the scheme's table is set in a way the cutter can't read.

Fixed on 25 October 2026:
- **Biology A Paper 2, November 2020** is a scan whose labels OCR's text reading
  misread, so only 6 of its parts got in. Its labels are now set by hand, read off
  the paper page by page (`labels/h42002-nov20.json`; `cut_pearson.py` reads a set's
  labels from `scripts/question-bank/labels/<set>.json` when there is one). All 54 parts
  (100 marks) are in, each with its own scheme rows, multiple-choice answers from the
  scheme's table.
- **Biology A AS Paper 2, November 2020**: OCR's listed mark scheme is another paper's.
  The right one is published at `643848-mark-scheme-depth-in-biology.pdf` (its running
  header wrongly says H420/02); 29 of the 30 parts now have their scheme rows, and the
  PDF is on R2 at the library's key, `ocr/OCR-H020-02-MS-NOV20.pdf`.
- **Marks that weren't read:** a "[1]" at the very foot of a page, just above OCR's
  footer, now counts for its part. That completed seven science papers. MEI Maths
  Paper 3 June 2018's Q2 prints its mark above its own label, so it is set in
  `labels/h64003-jun18.json`.
- **Scheme rows:** a row the scheme labels "16 (ii)" (its letter dropped) or "16(b)(k)" (a
  roman the font garbled) is now read as the part after the row above. A label read twice
  keeps the copy with a row under it. Physics A Paper 3 June 2017's scheme prints "(a)"
  without its letter, so its five rows are mapped in `labels/h55603-jun17.json`.

```bash
python3 scripts/question-bank/ocr/fetch_ocr.py [--maths]
python3 scripts/question-bank/ocr/spec_ocr.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/ocr-sciences
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/ocr-maths --whole
python3 scripts/question-bank/ocr/tag_ocr.py split    # tag, then: tag_ocr.py merge
python3 scripts/question-bank/ocr/maths_ocr.py split  # tag, then: maths_ocr.py merge
python3 scripts/question-bank/ocr/build_ocr.py && python3 scripts/question-bank/ocr/maths_ocr.py build
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-sciences --crops-only   # the PDFs are the library's
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-maths --crops-only
```
