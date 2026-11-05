# Edexcel A-Level sciences

Banks: `edexcel-a-level-biology-a`, `edexcel-a-level-biology-b`, `edexcel-a-level-chemistry`, `edexcel-a-level-physics`

Added 23 October 2026: every question from Pearson Edexcel's A-Level and AS
Biology A (Salters-Nuffield, 9BN0/8BN0), Biology B (9BI0/8BI0), Chemistry
(9CH0/8CH0) and Physics (9PH0/8PH0) papers, June 2016 to June 2025, at
`/question-bank/edexcel-a-level-biology-a` and so on. The Edexcel past-paper pages
for those subjects now serve our own copies too, examiner's reports and Biology's
pre-release scientific articles included.

That is 7,142 question parts from 187 papers: Biology A 1,748, Biology B 1,826,
Chemistry 2,028 and Physics 1,540, each tagged to a sub-topic.

Gaps, honestly:
- Pearson published six June 2019 papers as scans (Physics AS 1 and 2, A-Level 1
  and 2, Chemistry Paper 2, Biology A Paper 3). Only the parts OCR read cleanly and
  the mark scheme confirms are in the bank (about 80 of some 200); the whole papers
  are in the library.
- Biology B's June 2017 AS Paper 1 examiner's report isn't published.
- Marks add up exactly for all but a handful of papers; the rest are a mark or two
  short where a part's mark sat outside its crop.

The pipeline lives in `scripts/question-bank/edexcel_sciences/`, beside the AQA one
and in the same shapes, so the site reads both alike:

- `fetch_pearson.py`: Pearson's past paper search lists every file of a
  specification; the file is downloaded unmodified. Pearson keeps the latest
  series for teachers only, so it arrives a year late. Pearson's search files the
  odd document under the wrong type; the file name (`que`, `rms`, `pef`) wins.
- `spec_pearson.py`: the topic tree. The specification's own topics are the tiles.
  Under them, Chemistry's lettered sub-topics (6A Alkanes) and Biology B's numbered
  ones (1.1 Carbohydrates); Biology A and Physics print only numbered statements,
  so `GROUPS` gathers those into sub-topics by statement number.
- `cut_pearson.py`: labels are found by order rather than position ("(b)" only
  after "(a)"), because Pearson's margins move between years. Older mark schemes
  are stored rotated, and are read and cropped as displayed. Six June 2019 papers
  were published as scans with no text: those are read with Apple's Vision OCR
  (`ocr.swift`, macOS only), and any part whose crop may have run into a missed
  label is left out.
- `tag_pearson.py` and `tag.md`'s Edexcel section: topic tagging, as for AQA.
- `build_pearson.py`: the data files, and `files-edexcel-sciences.json` for the library.

```bash
python3 scripts/question-bank/edexcel_sciences/fetch_pearson.py
python3 scripts/question-bank/edexcel_sciences/spec_pearson.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py      # --only=9ch001-jun26 for one paper
python3 scripts/question-bank/edexcel_sciences/tag_pearson.py split   # tag the new batches, then:
python3 scripts/question-bank/edexcel_sciences/tag_pearson.py merge
python3 scripts/question-bank/edexcel_sciences/build_pearson.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-sciences --papers=edexcel
```
