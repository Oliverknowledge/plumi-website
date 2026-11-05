# Computer Science (OCR and AQA)

Banks: `ocr-a-level-computer-science`, `aqa-a-level-computer-science`

Added 26 October 2026, the bank's first Computer Science: `/question-bank/ocr-a-level-computer-science`
(A-Level H446 and AS H046) and `/question-bank/aqa-a-level-computer-science` (A-Level 7517
and AS 7516), on the existing OCR and AQA A-Level shelves. Every paper is the board's own
file from ocr.org.uk or aqa.org.uk (AQA's newest files sit on its CDN, linked from its
pages); the whole papers are on R2 under `ocr/OCR-H446-01-QP-JUN24.pdf` (the library's
naming) and `aqa/AQA-75171-QP-JUN24.pdf`, the crops under `bank/h446*`, `bank/h046*`,
`bank/7516*` and `bank/7517*`.

- **OCR: 593 parts** from 18 papers: A-Level Papers 1 and 2 for November 2021 and June
  2022 to 2025, AS Papers 1 and 2 for June 2022 to 2025. Every paper's parts add up to its
  140 (AS 70) marks, every part has its own mark scheme rows, and 500 (all but a few of the
  June parts) have the examiner's comments on their question. Topics: the A-Level's 24 numbered topics (1.1.1
  Structure and function of the processor … 2.3.1 Algorithms) in 8 sections; AS papers
  are tagged with the same codes. All but 1.3.1 and 2.1.5 are AS content.
- **AQA: 561 parts** from 22 papers: A-Level and AS Papers 1 and 2 for November 2020 and
  June 2022 to 2025, and A-Level Papers 1 and 2 for November 2021 (AQA sat no AS then).
  Every Paper 2 adds up to its 100 (AS 75) marks, every part has its own mark scheme rows,
  and 435 have the examiner's comments on their question. Topics: the A-Level's 51 three-number topics (4.2.6
  Hash tables, 4.10.4 SQL) in 13 sections, the project (4.14) left out; 24 are AS content.
- **AQA Paper 1 is sat on screen**, around a Skeleton Program and Preliminary Material
  AQA sends schools beforehand. Its first section (theory) and its programming task
  ("write a program…", starting from an empty project) stand on their own and are here,
  their marks adding up to what the paper prints before the Skeleton Program section
  (A-Level 38–50 of 100, AS 18–25 of 75). The section headed "These questions refer to the
  Preliminary Material and the Skeleton Program", and the one after it (changing the
  program), are left out: they can't be answered without the program. The paper filter
  says so ("On-screen: theory and programming task"), and so does the bank page.
- **Code is cropped whole:** listings, trace tables, SQL and LMC programs come with the
  part that asks about them. OCR prints a part's code once, above its first sub-part:
  every sub-part carries it here (1(c)(ii) shows the quick sort that 1(c)(i) did).
- **Pipeline:** `scripts/question-bank/computer_science/`: `fetch_ocr_cs.py` (OCR's
  assessment page), `fetch_aqa_cs.py` (fetch_aqa.py over 7516/7517, plus the preliminary
  material, fetched only to read), `spec_cs.py`, `cut_ocr_cs.py` (cut_pearson.py as a
  library, unchanged), `cut_aqa_cs.py` (cut.py, patched for this run only),
  `tag_cs.py` (briefed by tag.md's Computer Science section) and `build_cs.py`.
  Seven scheme rows the schemes number differently from the papers (OCR prints "4(a)(i)"
  for a paper's 4(a)) are put right in `scripts/question-bank/labels/<set>.json`.
- **OCR's older series, from Physics & Maths Tutor (27 October 2026).** OCR publishes
  A-Level from November 2021 and AS from June 2022 only; the earlier series are on Teach
  Cambridge, its teacher login. The founder asked for them from PMT, for the question bank
  only (not the past paper library): A-Level June 2017-2019 and November 2020, AS June
  2016-2019 and November 2020, 18 papers and 565 parts (`fetch_pmt_ocr_cs.py`, run after
  `fetch_ocr_cs.py`; PMT's copies are OCR's own PDFs, with a "PMT" stamp in the top corner
  outside every crop). Every paper adds up (140 and 70). Four needed label files: AS Paper 2
  2016 (Q7's four one-line parts share one "[4]"; each gets 1 mark and the scheme's Q7
  block) and 2017 (a numbered answer list read as Questions 1-3), A-Level Paper 1 November
  2020 (Q4's "(a) (i)" on one line; Q6 and Q8 the scheme files as "(a)") and Paper 2 June
  2017 (parts printed "(c*)"). Ten parts link to the whole scheme (Paper 1 June 2019 Q10,
  AS Paper 2 November 2020 Q2(b)-(d) and June 2019 Q4(b)), whose rows the cutter can't
  find. PMT has examiners' reports for only two of these papers, so they have none here.
  `tag_cs.py split` now batches only the parts not yet tagged.
- **Gaps:** there are no OCR series before June 2016 (AS) or June 2017 (A-Level). OCR's November 2021 reports comment on the paper as a whole, not
  question by question (OCR says so), and its H446/01 November 2021 question 7(c)(ii)
  had an error (a corrected paper went to centres only), so that part is left out. AQA
  publishes November 2020 on; its file store has nothing earlier for 7516/7517. AQA has no
  reports for November 2020 (except A-Level Paper 2) or November 2021, nor for AS Paper 1
  June 2025. AQA's A-Level Paper 1 June 2025 report is headed "7516/2" on its pages; its
  content is 7517/1's.

```bash
python3 scripts/question-bank/computer_science/fetch_ocr_cs.py
python3 scripts/question-bank/computer_science/fetch_aqa_cs.py
python3 scripts/question-bank/computer_science/spec_cs.py
python3 scripts/question-bank/computer_science/cut_ocr_cs.py      # --only=h44602-jun25
python3 scripts/question-bank/computer_science/cut_aqa_cs.py      # --only=75172
python3 scripts/question-bank/computer_science/tag_cs.py split    # tag, then: merge
python3 scripts/question-bank/computer_science/build_cs.py        # also stages the whole papers in <work>/r2/pdf
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-cs/r2 --pdf-prefix=ocr/   # r2/img -> ../img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-cs/r2 --pdf-prefix=aqa/
```
