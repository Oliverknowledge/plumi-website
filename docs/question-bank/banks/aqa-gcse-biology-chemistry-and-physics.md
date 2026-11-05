# AQA GCSE Biology, Chemistry and Physics

Banks: `aqa-gcse-biology`, `aqa-gcse-chemistry`, `aqa-gcse-physics`

`/question-bank/aqa-gcse-biology`, `-chemistry` and `-physics`, for "AQA GCSE
Physics questions by topic": every question from AQA's GCSE Biology (8461),
Chemistry (8462) and Physics (8463) papers, Foundation and Higher, June 2018 to
June 2025 plus the specimen papers. That is 4,902 question parts from 95 papers
(1,505 Biology, 1,744 Chemistry, 1,653 Physics), cut part by part exactly like the
A-Level ones, with their mark scheme rows and examiner's reports. Topics are the
specification's 86 numbered topics (4.1.1 Cell structure), with no year split.

- **Pipeline:** `scripts/question-bank/aqa_gcse/` runs the A-Level scripts over
  the GCSE specifications: `fetch_gcse.py` (fetch_aqa.py with GCSE pages and
  components), `spec_gcse.py` (spec.py for the `4.x` numbering), `cut_gcse.py` (`cut.py`
  with `setups.py`'s rule), and `build_gcse.py`, which also holds the short topic names used in page titles
  and addresses (`short` in the JSON) so every `<title>` stays under 60 characters.
- **Setups (re-cut 4 November 2026, `cropVersion` 1):** the fault a student reported on Combined
  Science, below: a setup printed above a part's label stayed on the part before, so a PDF of the next
  part went without it. `cut_gcse.py` takes the same rule as `cut_trilogy.py`, now in `setups.py`, and
  only these banks and Combined Science use it. 875 crops changed of 4,902 (332 Biology, 274 Chemistry,
  269 Physics): 166 parts gave a setup to the next part (77, 57, 32), 181 took one in, and the rest lost
  only AQA's "Question 3 continues on the next page" or a crossed-out "DO NOT WRITE ON THIS PAGE" page.
  Ids, marks and every paper's total stayed the same. Only those crops and their rows (size, preview,
  search text) were updated, not a whole rebuild. Reading every moved setup's text and before-and-after
  sheets caught eight wrong moves the totals passed, so the rule now also leaves a sentence with lines
  to write on under it ("A thin layer of onion epidermis is used."), a row with something beside it
  ("Conclusion 1:" and its words), a specimen paper's tick-box options, and "Convert...", "Each organism
  may be..." and "The first box has been completed...". Combined Science's 86 papers cut the same with
  those changes. As there, a later part can still lean on an earlier part's own words. Some specimen
  crops still lose the end of "[1 mark]" at the right edge: `cut.frame`'s fix on
  `claude/question-crops-audit` wasn't applied here.
- **Crops and rows go live together:** the study feed (`Crop.tsx`) draws a crop at its row's `w`/`h`, so
  a new crop with an old row is squashed (one grown from 601 to 2,174 tall drew at 28% of its height);
  the bank pages use the picture's own shape. And a `cropVersion` that goes live before its crops are up
  caches the old crop under the new address for a year. So upload the crops as close before the merge
  as you can, never after it.
- **Tags:** GCSE mark schemes print each row's specification reference, so 91% of
  parts are tagged from AQA's own references (`tag_batches.py split` writes them
  to `.work-gcse/tag/refs.json`); the other 444 were tagged by Claude following
  `tag.md`, one by hand (`overrides.json`).
- **Gaps:** AQA no longer publishes twelve of the June 2018 and 2019 papers
  (Biology 1F and both Paper 2 tiers in 2018, all four Biology papers in 2019,
  Chemistry Paper 2 in 2019, Physics Paper 1 in 2018 and 1H in 2019), and withdrew Biology Paper 1H June 2018 Question 6. Chemistry Paper 2F June 2018 is
  a scan, so it isn't in the bank. AQA published no examiner's reports for most
  November Foundation papers. 141 parts (3%) link to the whole mark scheme
  instead of a cropped row. Foundation and Higher papers share some questions, so
  those appear twice, once per tier.
- **Maths** (8300) isn't in yet: its papers number questions "6 (a)" rather than
  "0 6 . 1", its files are listed by number, and its specification is coded (N1,
  A1), so it needs its own fetch, cut and topic list.

```bash
npm run bank:fetch:gcse
npm run bank:spec:gcse
npm run bank:cut:gcse
python3 scripts/question-bank/tag_batches.py split scripts/question-bank/.work-gcse   # then tag the batches
python3 scripts/question-bank/tag_batches.py merge scripts/question-bank/.work-gcse
npm run bank:build:gcse
npm run bank:upload -- scripts/question-bank/.work-gcse
```
