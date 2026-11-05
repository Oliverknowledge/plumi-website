# OCR A-Level Religious Studies

Added 1 November 2026: `/question-bank/ocr-a-level-religious-studies`, every question from the
OCR A-Level Religious Studies (H573) papers that OCR publishes on its own site: November 2021 and
June 2022 to June 2025. That is 136 questions from 34 papers: H573/01 Philosophy of religion,
H573/02 Religion and ethics, and the five Developments in religious thought papers, H573/03
(Christianity) to H573/07 (Hinduism; there was no Hindu paper in November 2021). Every question
has its mark scheme cropped, and 92 have their examiners' report.

- **The option.** A student sits Papers 1 and 2 and one Paper 3, set for the religion they study.
  The Paper 3s are named "Paper 3 (Christianity)" and so on, and, as in the Eduqas A Level bank,
  each carries its `option` (`C`, `I`, `J`, `B`, `H`), as does its religion's section of the
  topics, so the Religion filter keeps a student's own Paper 3 and the two papers everyone sits.
  The bank's note says so. No page code was needed.
- **Questions are whole.** Each paper sets four 40-mark essays ("1* … Discuss. [40]") and asks for
  any three, so there are no parts, choices or stems.
- **Mark schemes.** `cut_ocr_rs.py` uses the OCR Law cutter (`cut_ocr_law.py`) as a library,
  unchanged: it finds each question's indicative content by its number and opening words. Each
  crop is that content (AO1, then AO2, with OCR's guidance column), then both levels grids every
  essay is marked on: AO1 (16 marks) and AO2 (24 marks), from the AO1 grid's "(14–16)" band to
  the AO2 grid's "(1–4)", a page or two each. OCR puts the grids and the marking instructions
  after the content in some years and before it in others; the grid and instruction pages are
  hidden from the heading search (the grids number their levels "2", "1" at the margin) and stop
  the last question's content, as does November 2021's older back page. The November 2021
  Buddhism scheme heads Question 2 "Asses the claim…", so the opening words are also matched by
  their first four letters. Every crop was checked by its text (AO1 and AO2 present, its own
  question at the top, nothing of the next question, the grids or the instructions) and a
  sample by eye.
- **Reports.** OCR reports on each question under "Question 1*". There are none for November
  2021, and none on OCR's page for Judaism and Hinduism in June 2022 and June 2024.
  OCR's link for the June 2024 H573/02 report is the AS report (H173/02, on other questions), so
  `fetch_ocr_rs.py` checks that each file names its own component and leaves that one out.
- **Topics.** 78 topics, read from the specification's content tables (the topic's name in the
  left column): 9 for philosophy, 9 for ethics, 12 for each religion. They're coded by section
  and order (`P5` Religious experience, `B9` Buddhism in the Far East) with an empty `ref`. The
  42 marked with an asterisk, which the AS teaches too, are Year 1 · AS; the rest Year 2.
  Every question is tagged by reading it (tag.md's "OCR Religious Studies" section). Buddhism's
  Meditation and Hinduism and the West have no question yet.
- **Pipeline.** `scripts/question-bank/ocr_rs/` holds `fetch_ocr_rs.py` (OCR's assessment page,
  read with `fetch_ocr_cs.py`'s reader), `spec_ocr_rs.py`, `cut_ocr_rs.py`, `tag_ocr_rs.py` and
  `build_ocr_rs.py`. Whole papers are on R2 under `ocr/` (`OCR-H573-01-QP-JUN24.pdf`), crops
  under `bank/h573*`.

**Gaps:**
- The A-Level was first sat in June 2018, but OCR's page lists only November 2021 and June 2022
  on. The June 2018 to November 2020 question papers are on Teach Cambridge (OCR's teacher login)
  only; a few June 2018 mark schemes are still on ocr.org.uk, but without their papers they're no
  use here. No mirror (PMT or other) is used: that needs the founder's say-so.
- The AS (H173), the sample assessment materials and the modified papers (zips) are left out.
- There's no past paper library page for Religious Studies yet, so the credit links to
  `/past-papers`.

```bash
python3 scripts/question-bank/ocr_rs/fetch_ocr_rs.py
python3 scripts/question-bank/ocr_rs/spec_ocr_rs.py
python3 scripts/question-bank/ocr_rs/cut_ocr_rs.py
python3 scripts/question-bank/ocr_rs/tag_ocr_rs.py split   # tag the batch, then:
python3 scripts/question-bank/ocr_rs/tag_ocr_rs.py merge
python3 scripts/question-bank/ocr_rs/build_ocr_rs.py
ln -sfn ../img scripts/question-bank/.work/ocr-rs/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-rs/r2 --pdf-prefix=ocr/
```
