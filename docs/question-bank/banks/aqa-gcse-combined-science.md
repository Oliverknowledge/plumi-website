# AQA GCSE Combined Science: Trilogy

`/question-bank/aqa-gcse-combined-science`, for "AQA GCSE Combined Science questions by
topic": every question from AQA's Combined Science: Trilogy (8464) papers, Foundation and
Higher, June 2018 to June 2025. That is 3,069 question parts from 86 papers, one bank for
all three sciences: Biology Paper 1 and 2, Chemistry Paper 1 and 2, Physics Paper 1 and 2,
each in two tiers. Every paper's parts add up to its 70 marks. Topics are the
specification's 61 numbered topics, by science: Biology 4.x, Chemistry 5.x, Physics 6.x.

- **Pipeline:** `scripts/question-bank/aqa_trilogy/`, the AQA GCSE scripts again.
  `fetch_trilogy.py` is fetch_aqa.py with Trilogy's file names (`8464B1F` for Biology
  Paper 1 Foundation, specimen papers as `84641B1F`). `spec_trilogy.py` reads the 4/5/6
  numbering. `cut_trilogy.py` is cut.py with three fixes kept to this bank, so no other
  bank's crops move: a question running over onto a page with an "Extra space" box (and
  its "[6 marks]") is no longer cut short, a label whose point isn't bold ("0 3 . 1",
  Chemistry 2H November 2021) is read, and a setup printed above a part's label goes
  with that part. `tag_trilogy.py` and `build_trilogy.py` follow.
- **Setups (re-cut 4 November 2026, `cropVersion` 1):** a student reported Chemistry 1H June
  2025's "Particle X consists of:" sitting on 03.1, so a PDF of 03.2 went without it. A part ends at the next
  label, and cut.py only moves a sentence of six or more words on a part with no tick boxes.
  `setups.py`'s `move_setups` (written for this bank, now shared with `cut_gcse.py`) also moves shorter sentences ("Figure 2 shows the results."),
  lead-ins ending in a colon, and setups below tick boxes; it drops AQA's "Question 3 continues on
  the next page" and any crossed-out "DO NOT WRITE ON THIS PAGE" page that came along with it. It
  leaves a tick box's or table's row, a part's own instructions ("Use the equation:") and, on a
  "complete the sentences" part, a sentence with a gap still to come. 710 crops changed
  of 3,069: 148 parts gave a setup to the next part, the rest lost only the "continues" line.
  Ids, marks and every paper's 70 stayed the same. Only those crops and their rows
  were updated, not a whole rebuild. A later part can still lean on an earlier part's own
  words (03.3 names particle X): the page's "Show question 3 so far" has them, the PDF doesn't.
- **Tags:** 2,744 parts (89%) are tagged from the scheme's own specification references.
  The other 325 were tagged by Claude following `tag.md`.
- **Practicals:** 526 parts. `practicals.py` and `bankHasPracticals` now count Combined
  Science as a science.
- **Gaps:** AQA no longer publishes ten June 2018 and 2019 papers: Biology 1F and 2F,
  Chemistry 2F and Physics 2F in both years, Physics 1F June 2018 and Physics 2H June 2019. The specimen papers are left out: their
  text runs past the cutter's right margin, which clips each question's marks. The
  same two cut.py fixes would likely help the other AQA banks: worth a re-cut there,
  with new crop versions.
- **Synergy** (8465) isn't in: few schools take it.

```bash
python3 scripts/question-bank/aqa_trilogy/fetch_trilogy.py
python3 scripts/question-bank/aqa_trilogy/spec_trilogy.py
python3 scripts/question-bank/aqa_trilogy/cut_trilogy.py
python3 scripts/question-bank/aqa_trilogy/tag_trilogy.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_trilogy/tag_trilogy.py merge
python3 scripts/question-bank/aqa_trilogy/build_trilogy.py
python3 scripts/question-bank/practicals.py split --only=aqa-gcse-combined-science --parts=scripts/question-bank/.work-gcse-trilogy/parts.json   # judge, then merge
npm run bank:upload -- scripts/question-bank/.work-gcse-trilogy
```
