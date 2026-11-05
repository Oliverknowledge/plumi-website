# Edexcel GCSE Biology, Chemistry and Physics

Banks: `edexcel-gcse-biology`, `edexcel-gcse-chemistry`, `edexcel-gcse-physics`

`/question-bank/edexcel-gcse-biology`, `-chemistry` and `-physics`, added 28 October 2026
after a student asked for "GCSE Edexcel Triple Science": every question from Pearson
Edexcel's GCSE (9–1) Biology (1BI0), Chemistry (1CH0) and Physics (1PH0) papers,
Foundation and Higher (1F, 1H, 2F, 2H), June 2018 to June 2025 with November 2020 and
2021, plus the Biology and Chemistry specimen papers. That is 5,268 question parts from
104 papers (Biology 1,834, Chemistry 1,880, Physics 1,554), cut part by part with their
mark scheme rows and examiner's reports. Every paper's parts add up to its 100 marks.
The paper filter is the tier filter ("Paper 1 Higher"), as in the AQA GCSE banks.

- **Source papers:** Pearson's own site only. `fetch_gcse.py` reads Pearson's past paper
  search (the sciences share the code `gcse16-science`) for November 2020 onwards; June
  2018 and 2019 come as one zip per subject and tier from the same search; the specimens
  are split out of each subject's "Sample assessment materials" book by its contents
  page. Pearson's server drops long downloads part way, so files are fetched with curl.
  Whole papers are on R2 under `edexcel/` (`1ph0-2h-qp-jun24.pdf`), crops under `bank/`.
- **Topics:** Pearson prints only numbered statements under each topic (2.1 … 2.33P), so
  `spec_gcse.py` groups them into sub-topics (`GROUPS`: 42 Biology, 38 Chemistry, 46
  Physics), as `spec_pearson.py` does for A-Level Biology A and Physics. A sub-topic shows
  its statement numbers (`points`), and the tiles are the specification's topics.
- **Cutting:** `cut_gcse.py` runs `cut_pearson.py` unchanged, with two GCSE-only patches so no
  other bank's crops move: a scheme table headed "Question Answer" on one line (Physics 2F
  June 2024), and a row marked once for a question on both tiers, labelled "8c(i)(F)" over
  "2(ai)(H)": each scheme keeps its own tier's number.
- **Tags:** every part was tagged by Claude following `tag.md` ("Edexcel GCSE sciences").
- **Practicals:** `practicals.py` and `bankHasPracticals` already count any Biology,
  Chemistry or Physics bank; the parts were judged as for the others.

Gaps, honestly:
- June 2026 is for teachers only on Pearson's site, so the bank stops at June 2025.
- Physics's specimen papers aren't in: Pearson's book is a 158 MB scan whose text
  layer is unreadable OCR.
- Chemistry 1F and Physics 1F June 2019 are scans. OCR missed their boxed question
  numbers, so their labels were set from the OCR'd part labels and each "(Total for
  Question N …)" line (`labels/1ch01f-jun19.json`, `labels/1ph01f-jun19.json`), checked
  row for row against their mark schemes; one mark on each, and one on Chemistry 1F
  June 2025, was read off the scheme. Scanned crops keep the scan's blank answer space.
- 41 parts (0.8%) link to the whole mark scheme instead of a cropped row, mostly
  six-mark questions whose scheme row the cutter didn't find.
- Foundation and Higher papers share questions, so those appear twice, once per tier.
- Combined Science (1SC0) is a bank of its own: "Edexcel GCSE Combined Science" below.
- The past paper library's Edexcel GCSE science pages still list their older copies;
  `build_gcse.py` doesn't write a library file yet.

```bash
python3 scripts/question-bank/edexcel_gcse/fetch_gcse.py
python3 scripts/question-bank/edexcel_gcse/spec_gcse.py
python3 scripts/question-bank/edexcel_gcse/cut_gcse.py          # --only=1ph02h-jun26 for one paper
python3 scripts/question-bank/edexcel_gcse/tag_gcse.py split    # tag the new batches, then:
python3 scripts/question-bank/edexcel_gcse/tag_gcse.py merge
python3 scripts/question-bank/edexcel_gcse/build_gcse.py
python3 scripts/question-bank/practicals.py split --only=edexcel-gcse-biology,edexcel-gcse-chemistry,edexcel-gcse-physics --parts=scripts/question-bank/.work/edexcel-gcse/parts.json   # judge, then merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse --pdf-prefix=edexcel/
```
