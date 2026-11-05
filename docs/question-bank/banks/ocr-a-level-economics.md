# OCR A-Level Economics

Added 28 October 2026: `/question-bank/ocr-a-level-economics`, every question from the
OCR A-Level (H460, Papers 1–3) and AS (H060, Papers 1–2) Economics papers that OCR
publishes on its own site. That covers A-Level November 2021 and June 2022 to June 2025, and AS
June 2022 to June 2025. That is 478 parts from 23 papers. Every part has its mark scheme cropped,
all 270 multiple-choice questions also carry their answer letter, and 269 parts have the
examiner's comments. Every paper adds up to its 80 (A-Level) or 60 (AS) marks, counting
one essay of each choice.

- **Case material.** A-Level Papers 1 and 2 open Section A with stimulus material, and AS
  Section B opens with a case study. Paper 3's Section B has three extracts. Up to June 2023
  all three come before the questions; from June 2024 each comes before its own questions.
  Each block runs from its heading ("Section B", "Read the extracts…", "Extract 2") to the
  next question. It is the stem ("Show how question 1 starts") of every question after it
  until the next block or section, and a part's crop stops where the next block begins.
  Paper 3's extract questions have no parts, so they are named for the block they share:
  `h46003-jun24-e2-34`, stem `h46003-jun24-e2-stem.webp`. A downloaded set prints each
  extract once. Because those ids carry a block, the bank keys its reports by part
  (`reportsBy: "question"`): each part carries its question's report, and the page leads
  with the part's own heading.
- **Crops end at the question.** A part is shown down to its first answer line. Where its
  marks sit at the end of the lines ("........ [8]"), that one line is shown under it.
- **Essay choices.** "Answer Question 2 or Question 3" (and 4 or 5, and AS 17 or 18): the
  second carries `or`. OCR's scheme prints both essays' headings over one levels table,
  then "Question 2* Guidance" and "Question 3* Guidance". Each essay's scheme crop is its
  own heading, the shared levels, and its own guidance.
- **Multiple choice.** Paper 3 questions 1–30 and AS 1–15. The scheme crop is the question's
  row of OCR's rationale table. The letter is read from the two-column key table where
  there is one, and otherwise from the row's Key column (past the tick some rows carry).
  The key table itself is not read as a scheme. All 270 letters match OCR's key tables
  where OCR prints one.
- **Topics.** The specification numbers each component from 1, so the codes put the
  component first. The sections are "Microeconomics 2: The role of markets" (`1.2`) and its
  topics, such as "2.6 Elasticity" (`1.2.6`, with `ref` "2.6" as printed). There are 10
  sections and 49 topics. A topic is Year 1 · AS where the AS specification has a topic of
  the same name (27 of them). AS questions take the A-Level's codes. Component 3 has no
  content of its own. Every part is tagged (tag.md's "OCR Economics" section; corrections in
  `tag/overrides.json`). No question tests Macroeconomics 2.6, Trends in macroeconomic
  indicators, on its own.
- **Pipeline.** `scripts/question-bank/ocr_economics/` holds:
  - `fetch_ocr_economics.py`: OCR's assessment page, read with `fetch_ocr_cs.py`'s reader.
  - `spec_ocr_economics.py`.
  - `cut_ocr_economics.py`: `cut_pearson.py` as a library, patched for this run only, so
    `cut_pearson.py` is unchanged.
  - `tag_ocr_economics.py`.
  - `build_ocr_economics.py`.

  Whole papers are on R2 under `ocr/` (`OCR-H460-01-QP-JUN24.pdf`, the library's naming),
  and crops are under `bank/h460*` and `bank/h060*`.
- **OCR's own slips, handled.** AS Paper 2 June 2025's scheme numbers question 2's row "1",
  so it is renumbered. That scheme also sets question 18's heading as a sentence ("18.
  Evaluate…") outside its table, so the heading is split off. Its assessment-objective grid
  at the back is left unread.

**Gaps:**
- OCR publishes only the series above. Older series sit on Teach Cambridge, OCR's teacher
  login, and are not fetched. These include the 2015 specification's papers and any AS
  series before June 2022. No mirror (PMT or other) is used: that needs the founder's
  say-so.
- The sample assessment materials are left out, as for the other OCR banks.
- OCR published no examiners' reports for November 2021 (all three papers) or AS June 2022,
  so 46 written parts have no comments.
- The AS reports don't discuss the multiple-choice questions. Paper 3's reports comment
  only on the multiple-choice questions candidates found hardest or easiest, so 107 of the
  270 have comments.
- June 2022 Papers 2 and 3 have OCR "post exam corrections", which are notices and not
  new papers. The crops show the papers as printed. In Paper 2's Fig. 3, "2009 4.9%"
  belongs in the "within margin" ring, not "outside target". In Paper 3's Extract 3, the
  last sentence of the first paragraph should say Fig. 3.1, not Fig. 3.2. Both notices
  are in the work folder (`h460-0[23]-corr-jun22.pdf`).
- There's no past paper library page for Economics yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/ocr_economics/fetch_ocr_economics.py
python3 scripts/question-bank/ocr_economics/spec_ocr_economics.py
python3 scripts/question-bank/ocr_economics/cut_ocr_economics.py
python3 scripts/question-bank/ocr_economics/tag_ocr_economics.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_economics/tag_ocr_economics.py merge
python3 scripts/question-bank/ocr_economics/build_ocr_economics.py
mkdir -p scripts/question-bank/.work/ocr-economics/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-economics/r2 --pdf-prefix=ocr/
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-economics --crops-only
```
