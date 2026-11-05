# Edexcel International GCSE Maths A (4MA1)

Added 1 November 2026: `/question-bank/edexcel-igcse-maths`, Pearson Edexcel International GCSE Mathematics A,
both tiers, every series Pearson's own site has public from January 2019 to June 2025, January and November
series included.

| Papers | Sittings | Questions | Scheme crops | Reports |
| --- | --- | --- | --- | --- |
| 1H, 2H (Higher), 1F, 2F (Foundation), all calculator | 26 (104 papers) | 2,567 (Higher 1,254, Foundation 1,313) | 2,567 | 2,065 |

Every paper's questions add up to its 100 marks.

- **Naming, shared with the Edexcel International GCSE sciences session:** board "Edexcel", level "IGCSE", shown
  as "International GCSE" (`bankLevel`, so titles read "Edexcel International GCSE Maths"); the hub key is
  "Edexcel International GCSE", on the GCSE & IGCSE shelf after the GCSE boards and before Cambridge IGCSE;
  "every paper" links go to the library's `/past-papers/gcse-maths/edexcel-igcse`.
- **Tiers:** papers are named "Paper 1 Higher", "Paper 1 Foundation" (ids `4ma11h`, `4ma11f`), as the GCSE
  Maths banks, so the "Higher only / Foundation only" links and `bankHasTiers` work (which now also accepts
  level "IGCSE", as does `tiers.py`). `tiers.json` holds 506 Foundation questions the Higher paper prints too:
  the union of the GCSE Maths Foundation branch's maths-aware `tiers.py` (498) and main's (495; six pairs the
  other missed, all checked by eye), plus two found by comparing crops and checked by eye
  (`4ma12f-jan22-22`, `4ma12f-jan20r-26`). Re-running `tiers.py` alone would drop those eight.
- **R papers:** most January and June sittings set a second paper for another time zone (1HR, 2FR…).
  Each is a series of its own, `JUN24R`, "June 2024 (R)", so the paper filter stays four papers; the
  bank's `note` says so. November 2020 to 2024 sittings and June 2021 have no R papers.
- **Sources, Pearson's own site only:** its search index lists every 4MA1 paper, scheme and report; the
  series is Pearson's own tag on each file (file names carry a date, and November 2020 sat papers printed
  "May 2020"). 289 files are the past paper library's copies already on R2 (`edexcel/EDX-4MA1-…`, checked byte
  for byte against Pearson's); 19 the library hasn't got (January 2021's papers and schemes, November 2021's
  schemes and reports, the off-pattern `4MA1_1H_msc_2019307.pdf`, one January 2020 2HR paper) are on R2 as
  `edexcel/4ma1-<paper>-<kind>-<series>.pdf`.
- **Cut** whole questions with the Edexcel GCSE Maths cutter (`gcse_maths/cut_pearson_gcse_maths.py`, on
  `cut_pearson.py --whole`), via `edexcel_igcse_maths/cut_igcse_maths.py`, which adds only what 4MA1 needs:
  - a frame for scanned pages (January 2019's papers carry some; June 2019's 2F and 2FR are scans throughout,
    with hand labels in `labels/4ma12f-jun19*.json` for the four question numbers OCR missed);
  - a question's marks from its "(Total for Question N is X marks)" line first;
  - the scheme reader sees the scheme through `SchemeLines`: only question numbers are labels, in order, bold or
    in the Q column (numbers in the working, "24 84", "2x", "20 ALT 1", took rows from the real question before),
    part labels removed (the reader joined "24" with "(a) eg" and dropped it), a label sharing a line with its
    working split off, and "Q" accepted as the Q column's header. Rows' text is still read off the scheme.
- **Scheme check:** every question's crop runs from its number to the next question's, across pages; every
  scheme's question count matches its paper's; where a scheme prints "Total N marks" the crop holds it. The
  only mismatches left are Pearson's: misprinted totals (June 2025 1F Q6 sums 3 marks and prints "Total 4";
  and 1H Q14, June 2022 1FR Q7, November 2021 1F Q21 and 1H Q12, November 2020 2HR Q12), a total left blank
  (November 2024 1H Q12, January 2020 2FR Q12), alternative methods and "Misread" rows with their own totals,
  and January 2019's schemes, which print no totals (checked by eye).
- **Topics:** the 4MA1 specification's own 39 topics, 1.1 Integers to 6.3 Probability, in its six areas
  (`spec_igcse_maths.py`, from Pearson's specification PDF; a topic's text is the Foundation content and what
  Higher adds). Tagged by Claude subagents per tag.md's 4MA1 section, one to three topics a question; a
  Foundation question its Higher paper prints too takes its twin's tags. No calculator filter (`noCalc`): both
  papers allow one.
- **Pipeline:** `scripts/question-bank/edexcel_igcse_maths/`: `fetch_igcse_maths.py`, `spec_igcse_maths.py`,
  `cut_igcse_maths.py`, `tag_igcse_maths.py`, `build_igcse_maths.py`. Ids `4ma11h-jun23-05`, `4ma12f-jan22r-14`;
  crops under `bank/` with those names.

## Gaps

- **November 2025 on:** Pearson lists November 2025, January 2026 and June 2026 for teachers only.
- **Not sat or not set:** no June 2020 (cancelled; November 2020 sat those papers), and no January sitting after
  2023 (the 2024 and 2025 January files are November's schemes and reports).
- **Examiner's reports:** none for June 2021; elsewhere they cover the questions the examiners commented on.
- **Specimen papers** (2016) are left out: before 2019, and one PDF of every paper.
- **Before 2019:** the brief starts at January 2019; Pearson also has June 2018 public.

```bash
pip install pymupdf pillow boto3
python3 scripts/question-bank/edexcel_igcse_maths/fetch_igcse_maths.py --from=<past-papers work dir>
python3 scripts/question-bank/edexcel_igcse_maths/spec_igcse_maths.py <international-gcse-in-mathematics-spec-a.pdf>
python3 scripts/question-bank/edexcel_igcse_maths/cut_igcse_maths.py
python3 scripts/question-bank/edexcel_igcse_maths/build_igcse_maths.py && python3 scripts/question-bank/tiers.py edexcel-igcse-maths
python3 scripts/question-bank/edexcel_igcse_maths/tag_igcse_maths.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_igcse_maths/tag_igcse_maths.py merge && python3 scripts/question-bank/edexcel_igcse_maths/build_igcse_maths.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-igcse-maths --crops-only   # the library-less PDFs: --pdf-prefix=edexcel/
```
