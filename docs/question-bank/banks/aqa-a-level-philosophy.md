# AQA A-Level Philosophy

Added 27 October 2026, after a student asked for it: `/question-bank/aqa-a-level-philosophy`,
every question from AQA's A-Level Philosophy (7172, Papers 1 and 2) papers that AQA still
publishes, November 2020 to June 2025. That is 120 questions from 12 papers, every one
with its mark scheme cropped whole (the levels-of-response grid and the indicative
content, across pages) and 70 with the examiner's comments. Every paper's marks add up
to its 100.

- **Whole questions.** Each paper is two areas of five questions: 3, 5, 5, 12 and 25
  marks (Paper 1: Epistemology 01–05, Moral philosophy 06–10; Paper 2: Metaphysics of
  God 01–05, Metaphysics of mind 06–10). A question is one crop, ending at its marks:
  the answer lines under it are left out, so a 25-mark essay is a one-line crop.
  Ids are `71721-jun24-05`; reports are keyed by question (`reportsBy` "question").
  No question is a calculation, so the filter is off (`noCalc`).
- **Topics:** the four areas as tiles, and under them the specification's own headings
  (`aqa_philosophy/spec_philosophy.py`): 28 topics, numbered on from the topic they sit
  under (3.1.2.1 Direct realism, 3.3.2.4 The problem of evil, 3.4.3.1 Philosophical
  behaviourism). "What is knowledge?" stays whole; Meta-ethics' opening (cognitivism and
  non-cognitivism) is a topic of its own, 3.2.3. All are year 0.
- **Pipeline:** `scripts/question-bank/aqa_philosophy/`: `fetch_philosophy.py` (fetch_aqa.py
  over 7171/7172), `spec_philosophy.py`, `cut_philosophy.py` (cut_psychology.py, whose
  layout Philosophy shares, with questions ending at their marks, the scheme frame
  widened to the text's 560pt, the areas' names in a section heading left out, and its
  own report reader for "Question 4:" / "04:" headings; cut.py and cut_psychology.py are
  unchanged), `tag_philosophy.py` (briefed by tag.md's AQA Philosophy section) and
  `build_philosophy.py`. Papers are on R2 under `aqa/AQA-7172*`, crops under `bank/7172*`.
- **Gaps:** AQA no longer publishes June 2019 (the A-Level's first series) and has no AS
  Philosophy (7171) papers on its site or file store, so the bank is A-Level only from
  November 2020. The specimen papers are left out, as for the other AQA banks. AQA
  published no reports for November 2020 or 2021, or for Paper 2 June 2024, so 50
  questions have no examiner's report. There's no past paper library page for
  Philosophy, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_philosophy/fetch_philosophy.py
python3 scripts/question-bank/aqa_philosophy/spec_philosophy.py
python3 scripts/question-bank/aqa_philosophy/cut_philosophy.py
python3 scripts/question-bank/aqa_philosophy/tag_philosophy.py split   # tag the batch, then:
python3 scripts/question-bank/aqa_philosophy/tag_philosophy.py merge
python3 scripts/question-bank/aqa_philosophy/build_philosophy.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-philosophy
```
