# GCSE Maths, Foundation and Higher tiers (AQA, Edexcel and OCR)

Banks: `aqa-gcse-maths`, `edexcel-gcse-maths`, `ocr-gcse-maths`

Added 28 October 2026, after the founder asked for "maths higher gcse" (no board named, so
the three main English boards): `/question-bank/aqa-gcse-maths`, `/question-bank/edexcel-gcse-maths`
and `/question-bank/ocr-gcse-maths`, every Higher tier question from 2017 to 2025, November
series included. The Foundation papers of the same series joined on 1 November 2026, when the
founder asked how the site covers both tiers (the science banks had both; maths left Foundation
students out).

| Bank | Higher papers | Foundation papers | Series | Questions (Higher + Foundation) | Scheme crops | Reports |
| --- | --- | --- | --- | --- | --- | --- |
| AQA 8300 | 1H (non-calculator), 2H, 3H | 1F (non-calculator), 2F, 3F | June 2017 to June 2025, with the specimen papers (16) | 1,304 + 1,362 | all | 1,134 + 1,143 |
| Pearson Edexcel 1MA1 | 1H (non-calculator), 2H, 3H | 1F (non-calculator), 2F, 3F | June 2017 to June 2025 (15) | 997 + 1,260 | all | 988 + 1,228 |
| OCR J560 | 4, 5 (non-calculator), 6 | 1, 2 (non-calculator), 3 | June 2017 to June 2025 (15) | 921 + 1,087 | all | 647 + 936 |

Every AQA and Pearson paper's questions add up to its 80 marks; every OCR paper's to its
100, bar June 2024 Paper 6 (99: one question's mark is a point short). All 138 Foundation
papers add up.

- **Tiers.** Each paper is named with its tier ("Paper 1 Higher", "Paper 1 Foundation", OCR's
  "Paper 4 Higher" and "Paper 1 Foundation"), as the science banks' are, so the paper filter
  offers "Higher only" and "Foundation only". The ids, crops and URLs of the Higher questions
  didn't change. `bankHasTiers` now reads the tier from the paper's name, not its id (OCR's
  ids are `j56001` to `j56006`), and the "show once" switch finds a Foundation question's
  Higher paper from its twin (`tiers.json`), not by swapping F for H.
- **On both tiers (`tiers.py`).** A sitting's Foundation papers pair with its Higher ones in
  the bank's order (1F with 1H; OCR 1, 2, 3 with 4, 5, 6). Maths keeps its numbers in the
  comparison (a shared question is the same sum), and also takes a pair whose words and
  numbers match as counts in any order, since the text layer often comes out in a different
  order on the two papers. 346 AQA, 305 Edexcel and 221 OCR Foundation questions are on the
  Higher paper too. Checked against the crops: a pixel comparison of every candidate pair,
  and by eye for every pair whose crops differ and a random sample of the rest. The bar keeps
  out Edexcel November 2024 2F Q18 and 2H Q11 (worded alike, different triangles). About a
  dozen pairs that print identically but whose text came out too differently are left
  unpaired (they show twice).

- **Sources, all the boards' own sites.** AQA's and OCR's papers, schemes and reports are the
  past paper library's crawl of aqa.org.uk and ocr.org.uk (already on R2 under `aqa/` and
  `ocr/`; the banks link to those copies). Pearson's come from its past paper search:
  June 2019 on as single PDFs (on R2 under `edexcel/` from the library), June 2017 to
  November 2018 as one public zip per series of question papers and mark schemes and
  another of examiner's reports, which `fetch_gcse_maths.py` takes both tiers' files out of
  (uploaded under `edexcel/1ma1-*`, with November 2020 Paper 2's report, which the library
  hadn't got, and the same for Foundation: 36 files from 2017 and 2018 and November 2020's three reports).
- **Cut a whole question at a time,** as every maths bank is (a later part builds on an
  earlier one): the question's words with the room to work in closed up, and all its
  scheme rows. AQA is `aqa_maths/cut_maths.py` run over the GCSE layout, which draws its
  working lines rather than typing them, prints the scheme as "Q | Answer | Mark | Comments"
  with each label centred in a cell spanning its rows (and printed again over a row
  carried to the next page), and heads its report parts "Question 9(a)", "Question 9(b)"
  (all kept). Pearson and OCR are `edexcel_sciences/cut_pearson.py --whole`, as for the
  OCR A-Level maths banks, plus: Pearson's "(Total for Question 1 is 3 marks)", the
  "Paper: 1MA1/1H" bar over each scheme page, bold-only question numbers (so "12" up a
  graph's axis isn't one), OCR's page number at the top of the page, and the end matter
  of both boards' schemes (OCR's appendix, Pearson's notes on its modified papers) kept out
  of the last question's rows.
- **Topics:** the DfE subject content all three specifications teach, N1–N16, A1–A25,
  R1–R16, G1–G25, P1–P9, S1–S6, under the six areas (Number; Algebra; Ratio, proportion
  and rates of change; Geometry and measures; Probability; Statistics). AQA and Pearson
  print those codes; OCR numbers its sections its own way but covers the same statements,
  so its questions take the same codes. The statements are read from AQA's specification;
  the short titles ("G20 Pythagoras and trigonometry") are ours. Topics with no question
  get no page (with Foundation in, Edexcel 1 and OCR 1 of the 97; AQA none). Tagged by Claude
  subagents per tag.md's GCSE Maths section; `batch-31` holds the 18 OCR questions found after
  a re-cut (November 2019 Paper 5's questions 7–21, which OCR numbers in regular type, and
  June 2019 Paper 5's question 19) and was tagged by hand. The Foundation papers are batches
  32 to 65, each copy of a shared question tagged on its own: on the 790 or so shared ones,
  the two tiers' tags overlap 95% of the time and agree on the main topic 83%.
- **Calculator filter:** the bank's `calcPapers` turns the "Calculations" filter (which the
  maths banks otherwise leave out, `noCalc`) into "Calculator: Allowed / Not allowed";
  a question's `calc` says its paper allows one (AQA and Pearson Papers 2 and 3 of either
  tier, OCR Papers 1, 3, 4 and 6), and each paper's title in the filter says which it is. The URL stays `?calc=only`
  (calculator) or `?calc=none` (non-calculator).
- **Pipeline:** `scripts/question-bank/gcse_maths/`: `fetch_gcse_maths.py`, `spec_gcse_maths.py`,
  `cut_aqa_gcse_maths.py`, `cut_pearson_gcse_maths.py`, `tag_gcse_maths.py`, `build_gcse_maths.py`.
  Ids: `83001h-jun23-09`, `1ma11h-jun23-05`, `j56004-nov22-12` (Foundation `83001f-…`, `1ma11f-…`,
  `j56001-…`); crops under `bank/` with those names. Two AQA cutter fixes came with Foundation:
  the 2F specimen spaces its "END  OF  QUESTIONS" (the cutter ran off the last page), and the
  3F specimen's and November 2017 2F's scheme rules stop at x 90.0; and working lines indented
  under a part's label (x 117) are left out like full-width ones.

## Gaps

- **November 2025:** no board has it public yet. Pearson lists it (and June 2026) for
  teachers only; AQA's and OCR's pages stop at June 2025. Add it when they publish.
- **Specimen papers:** AQA's are in (they come as separate files and cut cleanly). OCR's
  three Higher specimens are one PDF for all three papers, and Pearson's Set 1 is teachers
  only while Set 2 and the sample assessment materials are single PDFs of every paper, so
  those are left out.
- **Examiner's reports:** OCR wrote one report for all six papers in June and November
  2017, and one for the three Higher papers in November 2019; those series have no
  per-question report. Otherwise reports cover the questions the examiners commented on
  (AQA's skip a few, the opening multiple-choice ones especially).
- **Scheme:** OCR November 2019 Paper 6 question 11, OCR June 2022 Paper 1 question 9 and
  Edexcel June 2022 Paper 3F question 7 aren't paired by the cutters; `ms_fallback.py` crops
  their rows.
- **Search:** Pearson's November 2019 Paper 2F has almost no text layer, so its questions
  are tagged (from their crops) but barely searchable by their words.
- **OCR's 2017 to 2022 Foundation reports** cover the three papers separately, but from 2023
  OCR writes one report for J560/01/02/03; those series have no per-question report.
- None of the three boards puts older papers of either tier behind a teacher login (Pearson's 2017
  and 2018 series are public, as zips), so no mirror was needed.

```bash
pip install pymupdf pillow boto3
python3 scripts/question-bank/gcse_maths/fetch_gcse_maths.py aqa --from=<past-papers work dir>   # and edexcel, ocr
python3 scripts/question-bank/gcse_maths/spec_gcse_maths.py <AQA's 8300 specification PDF>
python3 scripts/question-bank/gcse_maths/cut_aqa_gcse_maths.py
python3 scripts/question-bank/gcse_maths/cut_pearson_gcse_maths.py edexcel   # and ocr
python3 scripts/question-bank/gcse_maths/tag_gcse_maths.py split   # tag the batches, then:
python3 scripts/question-bank/gcse_maths/tag_gcse_maths.py merge
python3 scripts/question-bank/gcse_maths/build_gcse_maths.py
python3 scripts/question-bank/ms_fallback.py cut --bank=aqa-gcse-maths <work-dir>   # each bank, then upload, then apply
python3 scripts/question-bank/tiers.py aqa-gcse-maths edexcel-gcse-maths ocr-gcse-maths
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/gcse-maths/aqa --crops-only   # and edexcel, ocr
```
