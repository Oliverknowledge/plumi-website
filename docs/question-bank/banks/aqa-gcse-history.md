# AQA GCSE History

Added 1 November 2026: `/question-bank/aqa-gcse-history`, every question from AQA's GCSE History
(8145) papers that AQA still publishes, every option, November 2020 to June 2025. That is 350
questions from 95 papers (Paper 1 Section A: 111, Section B: 84; Paper 2 Section A: 68, Section B:
87), every one tagged and with its mark scheme cropped, 94 with their sources or interpretations
shown above them, and 245 with the examiner's comments.

- **Options.** AQA sets each option as its own paper, coded by paper, section and option:
  `81451AA` is 8145/1A/A (America, 1840–1895), `81452BC` is 8145/2B/C (Elizabethan England).
  That is 16 papers: period studies 1A/A–D, wider world depth studies 1B/A–E, thematic studies
  2A/A–C and British depth studies 2B/A–D. Each paper and its section of topics carries its
  option (`1ab`), so the bank uses the existing `options` filter, as Eduqas GCSE History and
  AQA A-Level Religious Studies do. No new page code was needed. The **Option** filter
  (`?option=1ab`) keeps one option's paper and topics. A student's four options together are
  their four papers under Paper.
- **Questions.** Every question has a bare label ("0 4") and no parts, so each is one row, id
  `81451ab-jun24-04-q`. The GCSE Geography cutter (`aqa_gcse_geography/cut_gcse_geography.py`)
  cuts them unchanged, setup ("Study Sources B and C in the Sources Booklet.") included.
- **Sources.** They are in each paper's insert (Sources Booklet or Interpretations Booklet).
  Each source is cut from its heading ("Source B", "Interpretation A") to the next, and a
  question's stem (`81451ba-jun22-02-stem.webp`) is the ones it names. Paper 1A's questions 1–3
  share Interpretations A and B. The insert is the paper's `ins` in `wholes`.
- **Mark schemes.** These aren't tables. Each question's scheme runs from its "0 | 1" label
  boxes to the next question's, across as many pages as it takes. So an essay's crop has its
  target, all four levels with their indicative content, and the SPaG grid (questions 1B/04 and
  2A/04). The "Question 04 requires students to produce an extended response" note above a
  label goes with that question. The cutter checks every scheme has its levels, every 8+ mark
  scheme its top levels, and every SPaG question its grid: all pass.
- **Reports.** These are one per section from June 2022 (`AQA-81451A-ER-JUN24`). They are
  split by option heading ("1AB:", "8145/2B/C", "BA Conflict…") and then by "Question 3".
  November 2020 has three, for 1A/B, 2A/A and 2B/C. November 2021 has none.
- **Topics.** These come from AQA's specification (`aqa_gcse_history/spec_gcse_history.py`),
  149 in all. A topic is one of an option's bullets, titled by its subject ("Weimar democracy").
  Each British depth study also has "The historic environment" (`2BC.site`), since the site
  changes every year. The tagging brief is in tag.md, "AQA GCSE History". Six bullets have no
  question yet (for example 1AB.5 The failure of Weimar democracy).
- **Pipeline.** `scripts/question-bank/aqa_gcse_history/`: `fetch_gcse_history.py` (fetch_aqa.py's
  sources), `spec_gcse_history.py`, `cut_gcse_history.py` (imports the GCSE Geography cutter and
  patches its scheme labels; the shared cutters are unchanged), `tag_gcse_history.py` and
  `build_gcse_history.py`. Papers are on R2 under `aqa/AQA-8145*` and crops under `bank/8145*`.
- **Gaps:**
  - June 2018 and June 2019 are withdrawn from AQA's site (the file store answers 404). Option
    1B/E wasn't sat in November 2021.
  - 78 source and interpretation questions are left out. AQA's public inserts often withhold
    a source for copyright ("Source A cannot be reproduced here due to third-party copyright
    restrictions"), and a question can't be answered without its source. That is 33 from Paper 1A
    (1A/D loses its interpretation questions in every sitting but November 2021), 32 from 1B, 4
    from 2A and 9 from 2B. The rest of those papers' questions are kept. The list is
    `.work/aqa-gcse-history/dropped.json`.
  - June 2025's 1B/B and 2B/A question papers are filed under their section's code (`81451B`,
    `81452A`); the fetcher reads the option off the cover. June 2025's 2B/D insert is published
    only as modified copies, and its interpretation is withheld anyway.
  - Specimen papers are left out, as for the other AQA banks.

```bash
python3 scripts/question-bank/aqa_gcse_history/fetch_gcse_history.py
python3 scripts/question-bank/aqa_gcse_history/spec_gcse_history.py
python3 scripts/question-bank/aqa_gcse_history/cut_gcse_history.py
python3 scripts/question-bank/aqa_gcse_history/tag_gcse_history.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_gcse_history/tag_gcse_history.py merge
python3 scripts/question-bank/aqa_gcse_history/build_gcse_history.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-gcse-history
```
