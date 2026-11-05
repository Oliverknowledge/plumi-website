# Edexcel A-Level Geography

Added 27 October 2026, after a student asked for it: `/question-bank/edexcel-a-level-geography`,
every question from Pearson's A-Level (9GE0, Papers 1–3) and AS (8GE0, Papers 1–2)
Geography papers that Pearson publishes on qualifications.pearson.com: AS June 2017 to
June 2025 (with October 2020), A-Level June 2018 to June 2025 (with October 2020 and
November 2021). June 2026 is for teachers only. That is 868 parts from 40 papers, every one
with its mark scheme and 801 with the examiner's comments.

- **Topics:** the specification's topics as tiles, each option a tile of its own ("2A
  Glaciated Landscapes and Change", "2B Coastal Landscapes and Change", 4A/4B, 8A/8B),
  and their enquiry questions under them ("Why are some locations more at risk from
  tectonic hazards?", key ideas 1.1–1.3). The specification numbers its key ideas, not its
  enquiry questions, so a topic's code (`1.EQ1`) isn't shown. Topics 1–4 are Year 1 · AS,
  5–8 Year 2 (`edexcel_geography/spec_geography.py`).
- **Options:** students answer Question 2 or 3 (Paper 1), 3 or 4 and 5 or 6 (Paper 2), and
  at AS Section B or C. Each option's questions are tagged to its own topic. No part is
  marked `or`: that is for a choice inside one question, and on a whole question it would
  leave the card with no marks. `check_geography.py` checks every question's parts against
  its printed "(Total for Question 2 = 20 marks)" and the section and paper totals with the
  choices: all 40 papers add up.
- **The Resource Booklet:** bound in after each paper. `cut_pearson.py --figures` reads
  it as figures (a figure runs from the end of the one before to the end of its caption,
  "Figure 2a" in bold under it) and puts the figures a question names ("Study Figures 4a,
  4b, 4c and 4d in the Resource Booklet") in its stem, after the question's own opening;
  "the resources in Section B" takes that section, "the whole of the Resource Booklet"
  all of it, and a question that names only the booklet takes its block ("The following
  resources relate to Question 2."). A one-part question set on the booklet (Paper 3's,
  AS Question 4 and 7) has it as its stem too, and its id ends `-q` (`9ge003-jun24-05-q`),
  because a stem is named for its question. Paper 3's last question is set on the whole
  booklet, about eleven pages: that stem is scaled to the 16,000px limit.
- **What `--figures` also changes** (geography only; it runs with `--extracts`, and every
  other bank cuts as before): a "Study Figure 2b in the Resource Booklet." line set just
  above "(b)" starts (b) rather than ending (a); a figure or table printed under a part's
  marks ("Complete the table below. (2)", then Figure 3) stays in that part's crop; the
  levels grids' "0 | No rewardable material" row and the schemes' page numbers aren't
  question labels, so 12- and 20-mark grids come through whole; a scheme row misprinted as
  the part after it ("6(aiv)" for 6(a)(iii)) is put right; and the reports' "Question 1c",
  "Question 1bi –", "Q1(a)(i)" and "Question Q1a" headings are read. Three papers' schemes
  need a hand fix in `labels/` (`ms_alias`, and the new `ms_copy` for a scheme row that
  answers two of the paper's parts).
- **Pipeline:** `edexcel_geography/` holds thin wrappers over the Pearson scripts:
  `fetch_geography.py` (Pearson's `al16-geography` search), `spec_geography.py`,
  `tag_geography.py` (tag.md's "Edexcel Geography" section), `build_geography.py`, and
  `check_geography.py`. Papers are on R2 under `edexcel/`, crops under `bank/`.
- **Gaps:** June 2026 is for teachers only. Paper 4 is the independent investigation
  (coursework), so there's nothing to cut. The October 2020 AS reports are one-page notices
  with no comments, so those 67 parts have none. Two schemes print one row for two of the
  paper's parts (October 2020 Paper 1 1(a)(i) and (ii), June 2023 Paper 2 5(a)(i) and (ii)),
  so both parts show that row. June 2022's AS papers were shortened that year, with a
  Section D choice of fieldwork questions; the two on Swanage are tagged to both 4A and 4B. There's no past paper library
  page for Geography yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/edexcel_geography/fetch_geography.py
python3 scripts/question-bank/edexcel_geography/spec_geography.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/edexcel-geography --extracts --figures
python3 scripts/question-bank/edexcel_geography/check_geography.py
python3 scripts/question-bank/edexcel_geography/tag_geography.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_geography/tag_geography.py merge
python3 scripts/question-bank/edexcel_geography/build_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-geography --pdf-prefix=edexcel/
```
