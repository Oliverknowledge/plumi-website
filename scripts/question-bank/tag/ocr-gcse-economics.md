# OCR GCSE Economics

`ocr_gcse_economics/tag_ocr_gcse_economics.py split` writes batches of OCR GCSE (9-1)
Economics (J205) parts to `.work/ocr-gcse-economics/tag/`, and `merge` collects them. The
brief is the one in `tag.md`, with these differences:

- `economics-topics.txt` lists the specification's 22 topics: `code | section | title — what
  learners should be able to do`. Codes are two numbers as the specification prints them
  (`2.3` Supply, `3.5` Fiscal policy); choose from these, never a section like `2`.
- Each line has its `paper` and `marks`. Paper 1 (Introduction to economics) tests sections
  1 and 2, codes `1.x` and `2.x`; Paper 2 (National and international economics) sections 3
  and 4, `3.x` and `4.x`. A Paper 2 question can still need a Paper 1 topic (interest rates
  and saving are `2.8`), but this is rare.
- Questions 1 to 20 are multiple choice: `question` holds the stem and options A to D,
  `scheme` the key ("Key: B."); tag the concept tested.
- Questions 21 to 23 are set on an extract, whose start is the `setup`: tag by what the part
  asks and its scheme, not by the extract's subject (a calculation of a firm's profit from a
  garden business's costs is `2.6`; "Explain what is meant by division of labour" is `2.1`).
- The 6-mark "Evaluate" and "Analyse" parts often span topics: give the main one first and a
  second only when the scheme's indicative content genuinely needs it.
