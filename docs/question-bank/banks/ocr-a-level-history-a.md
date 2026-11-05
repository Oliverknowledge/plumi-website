# OCR A-Level History A

Added 1 November 2026: `/question-bank/ocr-a-level-history-a`, every question from the OCR A-Level
History A (H505) unit papers that OCR publishes on its own site: November 2021 and June 2022 to
June 2025. That is 1,071 questions from 284 papers across 57 units: Unit 1, the British period
study and enquiry (Y101-Y113), Unit 2, the non-British period study (Y201-Y224; OCR lists no
papers for Y211), and Unit 3, the thematic study and historical interpretations (Y301-Y321).
1,067 questions have their mark scheme cropped with its levels grid; 554 have examiner's comments
(OCR publishes reports for about half the units each year).

- **Units as papers, unit groups as options.** Each unit is a paper ("Y106 · England 1485-1558:
  the Early Tudors") and a topic area of its key topics. A student sits one unit from each group,
  so the bank's `options` are the three groups, "Unit group", as Eduqas GCSE History's "Study":
  picking a group keeps its units' papers and topics, and the paper filter then picks a student's
  own units, several at once. No new filter code.
- **Sources and passages with their question.** Unit 1's source question ("Use the four sources
  ... [30]") and Unit 3's interpretations question ("Evaluate the interpretations in both of the
  two passages ... [30]") print their sources or passages under the question, so the question's
  crop runs from its number to "Section B" and takes them in. Where OCR's published paper has
  removed a source for copyright, the crop shows OCR's own notice, as the paper does.
- **Unit 2 parts.** Each Unit 2 question is "(a) Which of the following ... (i) ... (ii) ... [10]"
  and "(b)* ... [20]". The "(i)" and "(ii)" are the two factors to weigh, not sub-parts, so they
  are read as part of (a), in the paper and in the scheme.
- **Mark schemes with their levels.** OCR's schemes are its ruled table, each question's
  indicative content over a page or more, then "APPENDIX 1" with the paper's generic levels grids
  ("Generic mark scheme for Section A, Question 1 ... [30]", "... Question 1(b) and Question 2(b):
  Essay [20]"). Each scheme stops at the appendix, and the grid for the question's marks is set
  under it, so every scheme crop carries its levels. Some June 2024 Unit 2 schemes print their
  first table page without its header row, and Y217 June 2024's first row has "(a)" but no "1":
  both are read.
- **Topics.** The specification's key topics (bold, unnumbered) are coded by unit and place,
  `Y106.3`, with an empty `ref`: 330 topics for the 57 units. A Unit 1 unit has its enquiry topic's
  key topics and its period study's; a Unit 3 unit its thematic key topics and its three depth
  studies. Every question is tagged by reading it (tag.md's "OCR History A" section), choosing only
  among its own unit's topics of the right kind (the source question from the enquiry topic, the
  interpretations question from the depth studies). A key topic two units share ("Religious
  changes", Y106 and Y107) has its unit in its address.
- **Pipeline.** `scripts/question-bank/ocr_history/` holds `fetch_ocr_history.py` (OCR's
  assessment page, read with `fetch_ocr_cs.py`'s reader; downloads in threads, then reads each file
  one at a time to check it names its own unit), `spec_ocr_history.py`, `cut_ocr_history.py`
  (`cut_pearson.py` as a library with `cut_ocr_law.py`'s frame, regions and report reader, both
  unchanged), `tag_ocr_history.py` and `build_ocr_history.py`. Whole papers are on R2 under `ocr/`
  (`OCR-Y101-01-QP-JUN24.pdf`), crops under `bank/y1*`, `bank/y2*`, `bank/y3*`.

**Gaps:**
- OCR's page lists only November 2021 and June 2022 to June 2025. Earlier series are on Teach
  Cambridge (teachers' login) only and are not fetched; no mirror is used.
- OCR lists Y105's June 2025 report under June 2024 as well; the fetcher places it by the series it
  prints.
- Two of OCR's June 2025 links serve the wrong file: Y314's question paper link is a Y303 mark
  scheme, and Y222's mark scheme link is Y221's. So Y314 June 2025 is left out, and Y222 June 2025's
  four questions have no scheme crop (and no whole scheme to link).
- OCR's November 2021 Y104 paper prints Section B as a scanned image, read by `cut_pearson.py`'s
  OCR; its Question 3 opens with a straight quote ("3*  'The main reason..."), which the History
  cutter takes for a question's start. The topic-based essay (Y100, the NEA) has no paper, and the AS (H105),
  with its own units, isn't included. The sample assessment materials and modified papers are left out.

```bash
python3 scripts/question-bank/ocr_history/fetch_ocr_history.py
python3 scripts/question-bank/ocr_history/spec_ocr_history.py
python3 scripts/question-bank/ocr_history/cut_ocr_history.py
python3 scripts/question-bank/ocr_history/tag_ocr_history.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_history/tag_ocr_history.py merge
python3 scripts/question-bank/ocr_history/build_ocr_history.py
ln -sfn ../img scripts/question-bank/.work/ocr-history/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-history/r2 --pdf-prefix=ocr/
```
