# Edexcel A-Level Economics B

Added 31 October 2026: `/question-bank/edexcel-a-level-economics-b`, every question from
Pearson's A-Level (9EB0) Economics B Papers 1 to 3 that Pearson publishes, June 2017 to
June 2025 (June 2026 is for teachers only), nine sittings including October 2020 and
November 2021. That is 252 parts from 27 papers, every one with its mark scheme crop;
216 with the examiner's comments. The AS (8EB0) papers are a separate qualification and
aren't in the bank.

- **Papers:** Paper 1 "Markets and how they work" (Themes 1 and 4) and Paper 2 "Competing in
  the global economy" (Themes 2 and 3) are each a Section A data response (Q1, parts (a) to
  (h), 4 to 12 marks) and two 20-mark essays on extracts (Q2 and Q3, one part each).
  Paper 3 "The economic environment and business" is two sections of four parts (4 to 20
  marks) on extracts, after a context announced the year before. Every paper is 100 marks.
  Nothing is an alternative: all questions are compulsory.
- **Topics:** the specification's 23 numbered topics as tiles ("1.3 Introducing the market")
  and 85 sub-topics under them ("1.3.1 Demand"), shown by area, not by year: Economics B has
  no AS split (`edexcel_economics_b/spec_economics_b.py`).
- **Extracts:** as Economics A, `cut_pearson.py --extracts` attaches the extracts printed
  before a question to its stem. Economics B's one-part essays (Q2, Q3) are set on extracts
  too, so `--stem-singles` gives them a stem and their id ends "-q" (`9eb001-jun24-02-q`).
  From June 2025 the extracts are in a source booklet at the back ("Read Extracts A–F in the
  Source Booklet", "Source for use with SECTION B"): the cutter's patterns now take those
  wordings.
- **Schemes:** a 20-mark question's crop holds its indicative content and the levels grid,
  which Pearson prints on separate pages. Economics B's scheme tables put the question's words
  in their header row, so a page-closing header (the next question's, its first row overleaf)
  slipped past `cut_pearson.py`'s check and ended up under the question before: `cut_economics_b.py`
  cuts those off (34 of 252 crops). No row here is carried over a page with its label repeated
  ("contd"); if one turns up, the Pearson cutter's carry-over fix (`ms_carryover.py`) is the
  one to re-cut with.
- **Pipeline:** `edexcel_economics_b/` holds thin wrappers over the Pearson scripts:
  `fetch_economics_b.py`, `spec_economics_b.py`, `tag_economics_b.py` (tag.md's "Edexcel
  Economics B" section) and `build_economics_b.py`. The whole papers are the past paper
  library's copies (`scripts/past-papers/boards/edexcel_economics_b.py`,
  `edexcel/EDX-9EB0-<paper>-<kind>-<series>.pdf`), and `/past-papers/a-level-economics-b/edexcel`
  is the library page (Economics' first; `bankPapersPath` keeps Economics A and B on separate pages).
- **Gaps:** November 2021 had too few entries for an examiner's report ("Pearson will not
  publish an Examiner's Report"), so those three papers have none. June 2024 Paper 3's report
  has no readable text (its font carries no text mapping, as Economics A's), so its 8 parts
  have no comments. Paper 3's pre-release context booklets (a separate Pearson file, bound
  into the question paper from some years) are not hosted on their own.

```bash
python3 scripts/past-papers/boards/edexcel_economics_b.py            # fetch + library copies
python3 scripts/question-bank/edexcel_economics_b/spec_economics_b.py
python3 scripts/question-bank/edexcel_economics_b/cut_economics_b.py   # cut_pearson.py --extracts --stem-singles, plus one repair
python3 scripts/question-bank/edexcel_economics_b/tag_economics_b.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_economics_b/tag_economics_b.py merge
python3 scripts/question-bank/edexcel_economics_b/build_economics_b.py
python3 scripts/past-papers/upload.py edexcel-economics-b
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-economics-b --crops-only --checksum
```
