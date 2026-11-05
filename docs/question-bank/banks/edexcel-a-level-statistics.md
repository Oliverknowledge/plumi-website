# Edexcel A level Statistics and AS Statistics (9ST0, 8ST0)

Bank: `edexcel-a-level-statistics`

Added 5 November 2026 after a Discord member asked for "Statistics, Edexcel, A-level" (1 November) and "AS level
Statistics" (5 November), on iPad, web and Android. Their unit names (Numerical Measures, Normal Distribution,
PMCC/SRCC, Regression, Sampling, Binomial, Parameters and Statistics, Errors) are the content of Pearson's own
**Statistics** qualification, not the statistics inside Maths: Pearson Edexcel Level 3 Advanced GCE in Statistics
(9ST0), first taught September 2017, first examined 2019. It had an AS (8ST0, 2018 to October 2020, the last
sitting), which the January 2024 specification (Issue 2) no longer mentions. No other bank holds these papers:
`edexcel-a-level-maths` is 9MA0/8MA0, `edexcel-a-level-further-maths` 9FM0/8FM0, and the International A Level
banks have WST01 to WST03.

| Papers | Sittings | Questions | Scheme crops | Reports |
| --- | --- | --- | --- | --- |
| 9ST0/01 Data and Probability, 9ST0/02 Statistical Inference, 9ST0/03 Statistics in Practice (A level, 2 hours, 80 marks), 8ST0/01, 8ST0/02 (AS, 1 hour 30, 60 marks) | 8 (25 papers cut, 2 scanned) | 173 | 173 | 138 |

Every paper's questions add up to its marks: 80 for each 9ST0 paper, 60 for each AS paper. Calculators are allowed
in every paper, so the bank sets `noCalc` (no calculator filter), as the Maths banks do.

- **Source:** Pearson's own course-materials index (the public index `fetch_edexcel.py` reads), unmodified PDFs. The
  fetch is `edexcel_statistics/fetch_statistics.py`, which calls `fetch_edexcel.py` with the 9ST0 and 8ST0 codes. Whole
  papers are on R2 under `edexcel/`.
- **Series labels:** the autumn 2020 sitting is October 2020 (Pearson's mark scheme says "Autumn 2020") and
  autumn 2021 is November 2021; both are `NOV20` and `NOV21`, shown as "November", as the Maths banks show
  autumn 2020. June 2019's 9ST0 is the first A level sitting; AS ran in June 2018, June 2019 and October 2020.
- **Gaps:**
  - AS June 2019 (8ST0/01 and 8ST0/02) are scanned images with no text layer, so they are in the file list (`wholes`)
    but not cut. OCR could bring them in (about 12 questions).
  - June 2026 papers and schemes are on Pearson's site for teachers only, so they are not fetched.
  - Pearson published no examiner report for AS October 2020 ("last sitting") or for 9ST0 November 2021
    ("insufficient entries"), so those 35 questions have a scheme crop and no report.
- **Cutter:** `edexcel_statistics/cut_statistics.py` reuses `cut_edexcel.py` and changes how a question ends,
  because Statistics papers print answer lines after every part (the Maths cutter stops at the first line and
  took only part (a) of 9ST0/01 November 2021 question 4). A question here runs to its "(Total for Question N is M
  marks)" line; blocks of answer lines are cut out, long blank answer space is squeezed to 50px, and text under a
  "Question N continued" heading is kept. Three papers (9ST0/01 June 2023, 9ST0/02 November 2021, 9ST0/03 June 2023)
  are the usual layout on a bigger page, so the frame moves with the padding. Fixes for odd print: a total printed
  "10\xa0marks", "(Total Marks for Question 6 is 24 marks)", and AS Paper 2 June 2018 question 7, whose number
  prints as a stray symbol. No shared script was changed.
- **Topics:** the specification's 21 numbered content areas, in four shelves (`statistics_topics.json`); the code
  keeps the specification's own number (`R.14` is topic 14, Sampling, estimates and resampling), so a student's "unit
  14" matches. The Statistical Enquiry Cycle is assessed inside every topic and is not one.
- **Tags:** two Claude subagents, 5 November 2026, one per batch, from `tag/edexcel-statistics.md`. A question's
  words are the first 1,500 characters, so for the longest questions the tag follows the opening parts; a few were
  flagged as less sure (for example 9ST0/02 June 2023 Q3, 9ST0/02 June 2024 Q6, 9ST0/03 June 2024 Q6).

```bash
python3 scripts/question-bank/edexcel_statistics/fetch_statistics.py <work-dir>
python3 scripts/question-bank/edexcel_statistics/cut_statistics.py <work-dir>      # about 10 minutes
python3 scripts/question-bank/edexcel_statistics/tag_statistics.py split <work-dir>   # then tag, then merge
python3 scripts/question-bank/edexcel_statistics/tag_statistics.py merge <work-dir>
python3 scripts/question-bank/edexcel_statistics/build_statistics.py <work-dir>
python3 scripts/question-bank/upload_r2.py <work-dir> --pdf-prefix=edexcel/
python3 scripts/question-bank/upload_data.py edexcel-a-level-statistics --verify
```
