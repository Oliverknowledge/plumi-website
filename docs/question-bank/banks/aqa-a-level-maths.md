# AQA A-Level Maths

Added 26 October 2026, after students asked for it (AQA had no maths in the bank):
`/question-bank/aqa-a-level-maths`, every question from AQA's A-Level Mathematics (7357)
Papers 1–3, every series AQA has sat: June 2018 and 2019, November 2020 and 2021, June
2022 to June 2025. That is 426 questions from 24 papers, each paper's questions adding up
to its 100 marks, every one with its mark scheme rows cropped, and all but two with the
examiner's comments.

- **Cut a whole question at a time, like the other maths banks:** a question's words,
  label by label ("9", "9 (a)", "9 (a) (ii)"), each stopping where its answer lines
  start, stacked into one crop without the space to write in. Its scheme crop is the
  table's rows from its first label to the next question's (June 2018 prints "(b)"
  without its number), with the column headings where the scheme prints them over it.
- **Topics:** the specification's 19 lettered sections, A Proof to S Moments (there is
  no T), under Pure (A–J), Statistics (K–O) and Mechanics (P–S), shown with their
  letters ("G Differentiation"), as the other maths banks show Pure 1–10. Section codes
  are `Pure`, `Stats` and `Mech`, not letters: the topic filter takes section and topic
  codes alike, and M, P and S are topics. No question's marks are mainly for P
  (Quantities and units), so it has no page.
- **Text:** the papers' maths fonts put symbols at odd codes in the text layer ("y ¼ 2x þ 1"),
  a different set per font; `cut_maths.py` reads them back per font for search, tagging
  and the opening words.
- **Pipeline:** `scripts/question-bank/aqa_maths/`: `fetch_maths.py` (fetch_aqa.py over
  7357), `spec_maths.py` (the topics from AQA's specification PDF), `cut_maths.py`,
  `tag_maths.py` (briefed by tag.md's AQA Maths section) and `build_maths.py`. AQA's
  own papers were already on R2 under `aqa/` (the library's copies, byte for byte the
  same); crops are under `bank/7357*`. The bank was first cut part by part, so R2 also
  holds part and stem crops (`bank/73571-jun23-09-aii-qp.webp`, `-09-stem.webp`) nothing links to;
  a single-part question's crops are the same file both ways.
- **Gaps:** none in the papers: AQA publishes every series, scheme and report. Its
  reports say nothing on June 2018 Paper 1 question 14 or November 2020 Paper 2
  question 11. The specimen papers are left out, as for the other AQA banks.

```bash
python3 scripts/question-bank/aqa_maths/fetch_maths.py
python3 scripts/question-bank/aqa_maths/spec_maths.py <AQA's 7357 specification PDF>
python3 scripts/question-bank/aqa_maths/cut_maths.py
python3 scripts/question-bank/aqa_maths/tag_maths.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_maths/tag_maths.py merge
python3 scripts/question-bank/aqa_maths/build_maths.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-maths --crops-only
```
