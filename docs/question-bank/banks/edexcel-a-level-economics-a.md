# Edexcel A-Level Economics A

Added 25 October 2026, after a student asked for it: `/question-bank/edexcel-a-level-economics-a`,
every question from Pearson's A-Level (9EC0, Papers 1–3) and AS (8EC0, Papers 1–2)
Economics A papers that Pearson publishes, June 2016 to June 2025 (June 2026 is for
teachers only). That is 784 parts from 45 papers, every one with its mark scheme and
738 with the examiner's comments.

- **Topics:** the specification's numbered topics as tiles ("1.2 How markets work") and
  their sub-topics under them ("1.2.3 Price, income and cross elasticities of demand");
  themes 1–2 are Year 1 · AS, themes 3–4 Year 2 (`edexcel_economics/spec_economics.py`).
- **Extracts:** Section B and Paper 3 questions are set on two or three pages of figures
  and extracts printed before the question. `cut_pearson.py --extracts` attaches them to
  the question's stem ("Show how question 6 starts"), from the "Read the following
  extracts…" line to the question. From June 2025 the extracts are in a source booklet
  bound in at the back of the question paper: a "Read … in the Source Booklet" question
  takes the booklet's "Sources for use with SECTION B" block. The PDF builder slices a crop taller than a page
  across pages rather than shrinking it.
- **What `--extracts` also changes** (economics only; the sciences cut as before):
  a part's crop ends under its marks, its "(Total for Question 8 = 25 marks)", or above
  the "OR" of an essay choice, not pages of answer lines later; parts listed together and
  then printed again above their answer spaces end where the repeats begin, and take
  their marks from the repeat when the list has none; the even pages' bold page numbers
  at the left aren't question numbers; a question number with no text (June 2017
  Paper 2's "6") is inferred from its "(a)" straight after the extracts; mark schemes run
  on over pages of empty table borders into the levels grids, with the blank stretches
  closed up; and the reports' "Question 1 (a):", "1a", "1(a)" and "Question 6a asked…"
  headings are read.
- **Pipeline:** `edexcel_economics/` holds thin wrappers over the Pearson scripts:
  `fetch_economics.py`, `spec_economics.py`, `tag_economics.py` (tag.md's "Edexcel
  Economics A" section) and `build_economics.py`. Papers are on R2 under `edexcel/`,
  crops under `bank/`.
- **Gaps:** June 2024 Paper 3's examiner report has no readable text (its font carries no
  text mapping), so its 10 parts have no comments. One part, AS Paper 2 June 2019 5(b)(ii),
  has no marks of its own (its "(2)" covers 5(b) as a whole). There's no past paper library
  page for Economics yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/edexcel_economics/fetch_economics.py
python3 scripts/question-bank/edexcel_economics/spec_economics.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/edexcel-economics --extracts
python3 scripts/question-bank/edexcel_economics/tag_economics.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_economics/tag_economics.py merge
python3 scripts/question-bank/edexcel_economics/build_economics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-economics --pdf-prefix=edexcel/
```
