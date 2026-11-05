# AQA GCSE Geography

Added 31 October 2026: `/question-bank/aqa-gcse-geography`, every question from AQA's GCSE
Geography (8035) Papers 1, 2 and 3 that AQA still publishes, November 2020 to June 2025. That
is 611 parts from 18 papers (Paper 1: 234 parts, Paper 2: 245, Paper 3: 132), every one with
its mark scheme cropped and tagged to a topic, 86 multiple-choice parts with their answer
letter, and 85 questions with the examiner's comments.

- **Parts, each with its setup and figures.** The A-Level Geography cutter
  (`aqa_geography/cut_geography.py`) on the GCSE papers, which AQA sets the same way: a part
  is the lines and figures above its label, then its words down to its marks. Papers 1 and 2
  print their figures in the paper; their inserts are OS map keys, except November 2021
  Paper 2's, which holds two OS maps ("Study Figure 3, in the insert"): those are drawn into
  the parts that name them. Section headings and the choices' instructions ("Answer two
  questions from the following:") are left out, and a paper's first part keeps the setup
  above it.
- **Paper 3's resources booklet.** Section A (the issue evaluation) is set on the
  pre-release resources booklet. Each of its questions has a stem made of the booklet's
  pages for the figure it names ("Study Figure 2 in the resources booklet"), and the final
  9-mark question, which asks for "evidence from the resources booklet", has the whole
  booklet (`80353-jun24-03-stem.webp`). Its one-part question is `80353-jun24-03-q`. The
  booklet is also the paper's `ins` in `wholes`, and on the library's Paper 3 rows as
  "Resources booklet".
- **Options.** Paper 1 is hazards, the living world, and two of coasts, rivers and glacial
  landscapes; Paper 2 is urban issues, the changing economic world, resource management,
  and one of food, water and energy. Each option's parts are tagged only to its own topics
  (`tag_gcse_geography.py merge` rejects anything else), and none is marked `or`. A part that
  is itself a choice ("Either (hot deserts) … Or (cold environments) …", June 2025 02.10)
  counts one side's marks. `check_gcse_geography.py` checks every paper's printed total,
  SPaG included: all add up (88, 88, 76) except June 2025 Paper 2, where AQA prints
  `[1 mark]` on 04.3, 05.3 and 06.3 but 14 in each question's total box. The adapted papers
  of November 2021 and June 2022 print no total.
- **Mark schemes:** each row runs to the next part's row across as many pages as it takes,
  so a 9-mark question's crop has its levels grid, all of its indicative content and the
  SPaG grid (the cutter checks every 9-mark scheme has levels and indicative content).
  November 2021 Paper 3's scheme labels its 9-marker "s03"; that is read too. Multiple-choice
  letters come from the option the scheme names ("D. Volcanic activity"), matched to the
  paper's options. June 2024 Paper 1's 04.2 has none: its scheme gives "2.3 km (allow
  2.0–2.6 km)", which isn't one of the options.
- **Topics:** the specification's sections as tiles, its numbered topics (`3.1.1.2 Tectonic
  hazards`, `3.2.3.2 Food`), the key ideas of urban issues and the changing economic world
  (which the specification doesn't number, so no code is shown), Issue evaluation (`3.3.1`),
  the six stages of a fieldwork enquiry, and Geographical skills (`3.4.1`-`3.4.4`) as a
  second tag on skill parts (`aqa_gcse_geography/spec_gcse_geography.py`).
- **Pipeline:** `scripts/question-bank/aqa_gcse_geography/`: `fetch_gcse_geography.py`,
  `spec_gcse_geography.py`, `cut_gcse_geography.py` (the A-Level cutter's functions with the
  GCSE's additions; `cut_geography.py` and `cut.py` are unchanged), `check_gcse_geography.py`,
  `tag_gcse_geography.py` (briefed by tag.md's AQA GCSE Geography section) and
  `build_gcse_geography.py`. Library: `scripts/past-papers/boards/aqa_geography.py`
  (`/past-papers/gcse-geography/aqa`, 69 files). Papers are on R2 under `aqa/AQA-8035*`,
  crops under `bank/8035*`.
- **Gaps:** AQA no longer publishes June 2018 or June 2019 (its file store answers 404), so
  the bank starts at November 2020. The specimen papers are left out, as for the other AQA
  banks. Some figures are withheld for copyright in AQA's own copies ("-CR"): June 2022
  Paper 2's Figure 10, and articles in the June 2022 and June 2023 resources booklets, so
  those show AQA's notice. AQA publishes some sittings' colour inserts only as modified
  copies (A3, or reset at 18pt), whose photographs are replaced by descriptions; those
  copies only repeat figures the standard papers print, so they aren't used.

```bash
python3 scripts/question-bank/aqa_gcse_geography/fetch_gcse_geography.py
python3 scripts/question-bank/aqa_gcse_geography/spec_gcse_geography.py
python3 scripts/question-bank/aqa_gcse_geography/cut_gcse_geography.py
python3 scripts/question-bank/aqa_gcse_geography/check_gcse_geography.py
python3 scripts/question-bank/aqa_gcse_geography/tag_gcse_geography.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_geography/tag_gcse_geography.py merge
python3 scripts/question-bank/aqa_gcse_geography/build_gcse_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-geography --crops-only --checksum
python3 scripts/past-papers/boards/aqa_geography.py && python3 scripts/past-papers/upload.py aqa-geography
```
