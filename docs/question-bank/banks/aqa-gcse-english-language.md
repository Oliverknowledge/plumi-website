# AQA GCSE English Language

Added 30 October 2026, after a student asked for Paper 2: `/question-bank/aqa-gcse-english-language`,
every question from AQA's GCSE English Language (8700) papers that AQA still publishes,
November 2020 to November 2025, June and November each year. That is 75 questions from 19
papers (Paper 2: 41 from 9 sittings; Paper 1: 34 from 10), every one with its mark scheme
cropped and its examiner's comments. The same papers, with their inserts and the 2026
specimens, are in the library at `/past-papers/gcse-english-language/aqa` (84 files).

- **Topics are the question types.** Each paper sets the same five questions every series,
  each assessing the same objectives, so the topics are those ten questions under the
  papers' sections: Paper 1 Q1 listing information (AO1), Q2 language (AO2), Q3 structure
  (AO2), Q4 evaluating a statement (AO4), Q5 descriptive or narrative writing (AO5, AO6);
  Paper 2 Q1 true statements (AO1), Q2 summary of differences (AO1), Q3 language (AO2),
  Q4 comparing perspectives (AO3), Q5 writing a viewpoint (AO5, AO6). A question is tagged
  by its number, so there is no tagging pass.
- **Whole questions, sources in the insert.** Answers are written in the paper, so a
  question runs from its label to its first answer line (Paper 2's Q1, which has none,
  runs to its last statement). Paper 1's Q2 prints its extract, which the crop keeps. The
  sources are printed in a separate insert: the bank's `wholes` carries it as `ins`, and
  every question that mentions a source shows a "Sources (insert)" link to that sitting's
  insert (the writing questions don't). Picking one paper of one sitting also lists it
  with the whole paper. Search covers the sources' text.
- **Marks:** 4, 8, 8 (or 12), 20 (or 16) and 40: every paper adds up to 80.
- **Mark schemes:** each question's from its boxed label to the next (Q5's to the end, the
  AO5 and AO6 grids included), the running header and footer rules cut away.
- **Reports** head each question ("Question 3"); November 2024's Paper 1 report opens each
  question's paragraph with it in bold instead. A question gets everything under its
  heading up to the next one or the report's closing sections.
- **Pipeline:** `scripts/question-bank/aqa_english_lang/`: `fetch_english_lang.py`
  (fetch_aqa.py over 8700), `cut_english_lang.py` (cut.py's label finder and image helpers,
  cut.py unchanged) and `build_english_lang.py`. Papers are on R2 under `aqa/AQA-8700*`,
  crops under `bank/8700*`. The library's AQA fetcher (`scripts/past-papers/boards/aqa.py`)
  includes 8700, and `build.py` has the `gcse-english-language` subject.
- **Gaps:** AQA no longer publishes June 2017 to November 2019, so the bank starts at
  November 2020. Where AQA's copy blanks out a source for copyright, its reading questions
  (01 to 04) can't be answered and are left out, keeping the writing question: Paper 1 in
  June 2022 and November 2022, 2023 and 2025, and Paper 2 in November 2025 (Source A).
  AQA publishes no Paper 2 question paper or insert for November 2023 (scheme and report
  only), so that sitting isn't in the bank. June 2023 Paper 1's picture is blanked out in
  AQA's copy; its Q5 stays, as the description task still reads. The specimens (sample
  set 1, for the updated questions first examined in 2026) are in the library only.

```bash
python3 scripts/question-bank/aqa_english_lang/fetch_english_lang.py
python3 scripts/question-bank/aqa_english_lang/cut_english_lang.py
python3 scripts/question-bank/aqa_english_lang/build_english_lang.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lang
```
