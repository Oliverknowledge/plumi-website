# AQA GCSE Religious Studies

Added 31 October 2026: `/question-bank/aqa-gcse-religious-studies`, every question from AQA's
GCSE Religious Studies A (8062) papers that AQA still publishes, November 2020 to June 2025.
That is 650 parts from 53 papers: Component 1's seven religion papers (8062/11 Buddhism, /12
Catholic Christianity, /13 Christianity, /14 Hinduism, /15 Islam, /16 Judaism, /17 Sikhism;
410 parts), Paper 2A's thematic studies, themes A-F (180), and Paper 2B's textual studies,
St Mark's Gospel themes G and H (60). Every part has its mark scheme cropped and a topic tag,
all 130 multiple-choice parts have their answer letter, and 530 parts carry the examiner's
comments on their question.

- **Parts.** Every question is five parts, `0 1 . 1` to `0 1 . 5` (1, 2, 4, 5 and 12 marks,
  the 12-marker with 3 SPaG marks). `aqa_gcse_rs/cut_gcse_rs.py` is the AQA GCSE Geography
  cutter (itself the A-Level one) with three changes: a question's bare label heads its theme
  or area ("Theme A: Relationships and families", "Christianity: Beliefs"), so no stem crop is
  made; the multiple-choice instruction and options stay with their part; and a 2-mark part's
  numbered answer lines ("1", "2") are left out.
- **Religion filter.** Each Component 1 paper and its two sections carry their religion as an
  `option`, so the "Religion" filter keeps a student's paper and topics with Component 2's.
- **Paper 2B.** Its Section A reprints 2A's themes A-F on the same afternoon; the cutter checks
  them word for word against 2A (all 30 parts match in all six sittings) and keeps only Section
  B, questions 07 and 08, so nothing appears twice.
- **Mark schemes** aren't tables: each reprints its part under the same boxed label. A part's
  scheme runs from its label box to the next part's, across as many pages as it takes, less
  the heading above the next question, so every 12-mark crop has its levels grid, all its
  "Arguments in support" and "other views" content and, on Component 2, the SPaG grid (2 to 4
  pages each; the cutter checks levels and indicative content on every one). June 2022
  Islam's scheme sets its labels at 18pt, left of the usual frame; the frame starts at 14pt.
- **Topics:** 22 sections (each religion's beliefs and its practices, themes A-H) and 192
  topics, one per specification bullet point ("The Trinity", "Pilgrimage: Lourdes and Iona",
  "Just war theory"), with the bank's own codes (`CH1.3`, `TA.5`), so none is shown
  (`spec_gcse_rs.py`). A part's section is fixed by its paper and question.
- **Reports** comment by part ("1.1", "7.3"); `cut_gcse_rs.py` reads them by those labels and
  themes' headings. June 2025 Sikhism's report has only general comments, so it gives none.
- **Pipeline:** `scripts/question-bank/aqa_gcse_rs/`: `fetch_gcse_rs.py`, `spec_gcse_rs.py`,
  `cut_gcse_rs.py` (`cut.py`, `cut_geography.py` and `cut_gcse_geography.py` unchanged),
  `tag_gcse_rs.py` (briefed by tag.md's AQA GCSE Religious Studies section) and
  `build_gcse_rs.py`. Papers are on R2 under `aqa/AQA-8062*`, crops under `bank/8062*`.
- **Gaps:** AQA no longer publishes June 2018 or June 2019 (404), so the bank starts at
  November 2020. Catholic Christianity wasn't sat in November 2021. No November report was
  published for most religions and for 2B. The 2026 specimens, AQA's exemplar answers and the
  modified papers are left out. Short Course (8061) and Specification B (8063) aren't covered.

```bash
python3 scripts/question-bank/aqa_gcse_rs/fetch_gcse_rs.py
python3 scripts/question-bank/aqa_gcse_rs/spec_gcse_rs.py
python3 scripts/question-bank/aqa_gcse_rs/cut_gcse_rs.py
python3 scripts/question-bank/aqa_gcse_rs/tag_gcse_rs.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_rs/tag_gcse_rs.py merge
python3 scripts/question-bank/aqa_gcse_rs/build_gcse_rs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-rs
```
