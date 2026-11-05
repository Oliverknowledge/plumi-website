# AQA GCSE Design and Technology

Added 3 November 2026: `/question-bank/aqa-gcse-design-and-technology`, every question from AQA's
GCSE Design and Technology (8552) written paper (8552/W) that AQA publishes: November 2020, November
2021 and June 2022 to June 2025. That is 220 questions and parts from 6 papers, every paper adding
up to its 100 marks, every one tagged.

- **Questions.** Section A (core technical principles, 20 marks) opens with questions 01–10, ten
  whole 1-mark multiple-choice questions (60 in all), each carrying its letter (`k`) instead of a
  scheme crop. The rest of Section A, Section B (specialist technical principles, 30 marks) and
  Section C (designing and making principles, 50 marks) are short answers, calculations and drawings,
  some in parts ("2 0 . 1"). A figure, table or scenario printed above a question's parts is their
  stem (64 parts). Eight parts work from something printed only on an earlier part (the box in
  November 2021's 22.2, the two methods in June 2025's 24.3): each gets it repeated at the top of
  its crop (`SHARED` in `cut_dt.py`).
- **Answer spaces.** A big empty box or gap for sketching is cut down to about 60pt, so it doesn't
  bloat a crop; an isometric grid, a part-drawn figure and a plan-view box under 170pt tall stay
  whole. Ruled answer lines stay: `lib/questionSetPdf.ts` looks for them in a printed set. A crop
  ends above the page's own border: `cut_food.py`'s frame takes that border for a table's bottom
  rule, which would keep all the white space above it (81 crops here).
- **Mark schemes:** each part's row of AQA's "Qu | Part | Marking Guidance" table, cut from its label
  to the next and across pages (160 crops). Each multiple-choice key is read from Section A's "B Brass
  1 mark" rows and checked against the question paper's option B before it is kept. November 2020's
  20.1–20.3 share one row, so each shows it.
- **Examiner's reports:** November 2020 and June 2022 to June 2025 (135 questions; none for November
  2021). AQA's one comment on "Questions A1 to A10" goes on each of the ten; a part's comments sit
  under a "Question 15.1" heading, so the report panel shows a part's own first.
- **Topics:** the specification's three sections as tiles and their 27 numbered topics under them
  (`3.1.1` New and emerging technologies … `3.3.11` Specialist techniques and processes). Materials
  and their working properties is split in two (`3.1.6.1`, `3.1.6.2`). Sections B and C each have a
  "Selection of materials" and a "Specialist techniques and processes": short names keep them apart
  and give them different addresses.
- **Pipeline:** `scripts/question-bank/aqa_gcse_dt/`: `fetch_dt.py` (fetch_aqa.py over 8552, reading
  the paper's two filings, "8552W" to June 2023 and "85521" from June 2024), `spec_dt.py`, `cut_dt.py`
  (`aqa_gcse_food/cut_food.py` with patches made from it, no shared script changed), `check_dt.py`
  (a part naming a figure or table it doesn't print), `tag_dt.py` and `build_dt.py`. Papers are on
  R2 at `aqa/AQA-8552W-*`, crops at `bank/8552w-*`.
- **Not in the bank.** June 2019, the first sitting, isn't on AQA's site and redirects on its file
  store, so the bank starts at November 2020. Only AQA's own site is used. The specimen papers, the
  modified papers and the NEA are left out. No D&T past-paper library page exists, so the bank has no
  library link. AQA's November 2020 and 2021 papers and schemes are printed "June 2020" and "June
  2021" inside; they are the papers sat in those Novembers, and AQA's page lists them so.

```bash
python3 scripts/question-bank/aqa_gcse_dt/fetch_dt.py
python3 scripts/question-bank/aqa_gcse_dt/spec_dt.py
python3 scripts/question-bank/aqa_gcse_dt/cut_dt.py
python3 scripts/question-bank/aqa_gcse_dt/check_dt.py
python3 scripts/question-bank/aqa_gcse_dt/tag_dt.py split   # tag the batch, then:
python3 scripts/question-bank/aqa_gcse_dt/tag_dt.py merge && python3 scripts/question-bank/aqa_gcse_dt/build_dt.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-dt --checksum
npm run bank:data -- aqa-gcse-design-and-technology --verify
```
