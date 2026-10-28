# The question bank

`/question-bank`, one bank per subject, and a page per spec topic. Built 23 October 2026.

Every question from AQA's published A-Level Biology (7401/7402), Chemistry
(7404/7405) and Physics (7407/7408) papers, 2016–2025: about 6,400 question parts,
each cut out of its paper, paired with its own mark scheme rows, tagged to the
specification topic it tests, with the examiner's report on its question.

| URL | For |
| --- | --- |
| `/question-bank` | "A-Level question bank" |
| `/question-bank/aqa-a-level-chemistry` | "AQA A-Level Chemistry questions by topic" |
| `/question-bank/aqa-a-level-chemistry/<topic>` | "AQA A-Level Chemistry <topic> exam questions" |

The past paper library's AQA A-Level Biology, Chemistry and Physics pages now
serve our own copies of AQA's papers too, with AQA's examiner's reports.

## Where everything lives

- **Source papers:** AQA's own site. `scripts/question-bank/fetch_aqa.py` reads
  each specification's assessment-resources page (which lists June 2024 and 2025)
  and AQA's file store for older series.
- **Files we serve:** Cloudflare R2, at `NEXT_PUBLIC_PAPERS_URL`. Whole papers under
  `aqa/`, question crops under `bank/`. In development they're served from
  `public/papers-local` (a symlink into the gitignored work folder).
- **Data the site reads:** `src/content/questionBank/*.json` (topics, papers,
  series, the newest 20 parts; built into the pages) and
  `public/question-bank/<subject>/{parts,text,reports}.json` (fetched by the
  browser: the list, search text, examiner's reports).

## Gaps, honestly

- AQA no longer publishes nine Biology sets (its file store answers "not found"):
  A-Level Paper 1 June 2017–2019, Paper 3 June 2018, AS Paper 1 June 2016, 2018 and
  2019, AS Paper 2 June 2017 and 2018. A student asked for them, and the founder chose
  Physics & Maths Tutor's copies (28 October 2026), **for the question bank only**: 319
  parts, `fetch_pmt_aqa_biology.py` then `cut_aqa_bio_pmt.py --only=<set>` one set at a
  time. PMT's copies are AQA's own PDFs (its "PMT" stamp sits outside every crop), with
  no examiners' reports. `build_bank.py` keeps them out of `files.json`, the past paper
  library's list, and the whole-paper links point at our R2 copies under `aqa/`.
  `cut_aqa_bio_pmt.py` is cut.py with fixes for these older layouts: "1.1" scheme labels
  on headerless continuation pages, an answer's "1." run into its label, a stray number
  in a table cell taken for a label, and June 2016's "[n marks]" printed past the crop's
  right edge. That last one had clipped AQA's own AS Paper 2 June 2016 too (and hidden
  13 of its mark counts); it is re-cut, and Biology's `cropVersion` (in `build_bank.py`)
  makes browsers fetch the new crops. Every new paper adds up (91, 75; Paper 3's 103 is
  78 plus the second essay choice). Chemistry's AS June 2016–17 and A-Level June 2017,
  and some specimens, are clipped the same way and not yet re-cut.
- Rebuilding from the shared work folder: `build_bank.py` has changed since Chemistry
  and Physics were last built (it trims the search text and links some scheme crops to
  the whole scheme), so this run kept their files as they were and took only Biology's
  new and re-cut rows.
- Five older AS sets (Chemistry June 2016 and 2018, Physics June 2016–17) use a
  mark scheme layout the cutter doesn't read; their questions link to the whole
  mark scheme PDF instead of a cropped row.
- Marks add up exactly for 181 of 190 papers; the rest are a few marks short,
  and those parts show no mark count rather than a wrong one.

## Refreshing after a summer series

```bash
pip install pymupdf pillow boto3
npm run bank:fetch      # new papers from AQA (cached)
npm run bank:spec       # only if AQA revises a specification
npm run bank:cut        # cut every paper (about 10 minutes); --only=74051 for one paper
python3 scripts/question-bank/tag_batches.py split   # then tag the new batches, see scripts/question-bank/tag.md
python3 scripts/question-bank/tag_batches.py merge
npm run bank:build
npm run bank:upload     # to R2; needs the keys in .env.local (see upload_r2.py)
```

Then build, check a subject and a topic page, commit the JSON, and resubmit the
sitemap in Search Console.

## Column vectors and fractions at a question's top (maths), fixed 28 October 2026

A student sent screenshots of Further Maths vector questions (OCR Pure Core, Edexcel Further
Pure 1) whose column vectors had their top row cut off: a question's crop began at its
label, and a vector or a stacked fraction on that line starts above it. `cut_pearson.py`
and `cut_edexcel.py` now start a question at the highest line that starts 5pt or more above
its label and runs down past it (`label_top`), within its frame; the question above ends
there, so it no longer carries the sliced row either. The 5pt and the frame matter: plain
text a size larger than its label starts 1-4pt above it, and WJEC's "Examiner only" margin
column sits beside every label, and counting either pulled a page's rule into the crop.

Every maths bank cut by those two was re-cut, and only the question crops whose bytes changed
were uploaded (642; schemes are unchanged): OCR and OCR MEI A-Level Maths and Further Maths
(375 crops, `cropVersion` 3 to 4, `maths_ocr.py`'s own `CROP_VERSION` now that it differs from
the sciences'), Edexcel A-Level Maths and Further Maths (47), Edexcel and OCR GCSE Maths (107),
Cambridge A-Level Maths, Further Maths, IGCSE Maths and Additional Maths (54) and WJEC Maths
(59), the rest at `cropVersion` 1 (set in their build scripts too). The live rows took only
the changed crops' new width and height, since the shared work folders' other data can be
older than what is live. AQA's maths banks use `cut.py`'s boxed labels and weren't affected.
The sciences banks cut by `cut_pearson.py` part by part would change only where a part's line
holds a fraction or a vector, and weren't re-cut.

## Mark scheme crops (every board), fixed 25 October 2026

A student testing OCR found a multiple-choice question whose mark scheme was a
blank sliver. The same fault, in different forms, was in every board's crops:

- **Rows started 6pt above their label** (`cut_pearson.py`). OCR's and Cambridge's
  one-line rows sit 13pt apart, so a crop took the foot of the row above and lost its
  own: OCR's multiple-choice keys were slivers mixing two rows (and 424 answer letters
  went unread), and on a few Edexcel papers each question showed the row above's
  answer (9PH0/02 November 2021 Q4 said A; its answer is C). Rows now start at the
  table rule above their label (up to 60pt above, for a label centred in a tall cell;
  wide rules only, never one with text through it), or, with no rule, at the tallest
  text beside the label but never above the foot of the line before.
- **Crops ran to the page margins**, so they picked up the running header ("H020/01
  Mark Scheme June 2019"), the page number, the next table's header or the board's
  logo. A scheme page's box is now its table (`cut_pearson.ms_page_box`,
  `cut.ms_frame`), or inside the header and footer where nothing is ruled.
- **AQA's fixed frame** (`cut.frame`) cut the right-hand "AO / Spec Ref." column off
  nearly every GCSE scheme crop (the table runs to 557pt, the frame stopped at 541pt)
  and dropped rows below 766pt. Schemes now use `cut.ms_frame`. A bare number at the
  edge of the answer column ("24 × 3") is no longer read as a label.
- **Edexcel maths** (`cut_edexcel.py`): widened to the AOs column, and stops above
  the "Pearson Education Limited" footer.

Measured on the same PDFs, old cutter against new (scheme pieces whose edge runs
through a line of text): OCR sciences 2,471 to about 30, OCR maths 4,838 to 173,
Edexcel sciences 987 to 115, Cambridge 777 to 0, AQA GCSE 174 to 22 (and 3,309
cut off at the right to 1), AQA A-Level 247 to 42 (2,233 through a header to 7),
Edexcel Economics A (`--extracts`) 40 to 1. Psychology reads its schemes as text and
keeps its own frame.

Scheme images carry `?v=2` (`MS_VERSION` in questionBank.ts): the crops are cached for a
year as immutable and kept their names, so browsers that had the old ones refetch.

The fix was applied as a scheme-only update: each bank's question crops, sizes, text,
tags and marks are the live ones (re-cutting with a newer PyMuPDF moves some question
crops by a pixel or two), and only the scheme crop, scheme text and multiple-choice
key come from the re-cut, where it found the scheme. 176 parts gained a cropped row
(they used to link the whole scheme PDF) and 532 multiple-choice parts their answer
letter; no part lost a scheme. Parts the re-cut found that weren't in the banks (19,
mostly from scanned OCR papers) were left out: they'd need tagging.

## Edexcel Maths and Further Maths

`/question-bank/edexcel-a-level-maths` and `/question-bank/edexcel-a-level-further-maths`:
every question from Pearson Edexcel's current specifications, 9MA0 and AS 8MA0
(Maths) and 9FM0 and AS 8FM0 (Further Maths). That is 447 Maths questions from 47
papers and 824 Further Maths questions from 128 papers, cut whole question by
question, because Edexcel's mark schemes and examiner's reports go by question.
Topics follow the specification's numbered areas, with no Year 1 and Year 2 split.
The legacy modules (C1–C4, FP1–3, M1–5, S1–4, D1–2) are left out on purpose.

- **Source papers:** `fetch_edexcel.py` asks the public search index behind
  Pearson's course-materials pages for each spec code. Whole papers are stored on
  R2 under `edexcel/`, and crops under `bank/` next to AQA's.
- **Gaps:** Pearson keeps the June 2018 9MA0/8MA0 papers and June 2026 for
  teachers only. June 2019 9MA0 Paper 3 and 9FM0 Further Mechanics 1, plus the
  2018 AS Decision papers, are scanned images, so they're in the past paper
  library but not the bank. Every question has its marks, and all but 41 have a
  cropped mark scheme. The rest link to the whole scheme.

```bash
npm run bank:fetch:edexcel
npm run bank:cut:edexcel
python3 scripts/question-bank/tag_batches.py split scripts/question-bank/.work-edexcel   # then tag
python3 scripts/question-bank/tag_batches.py merge scripts/question-bank/.work-edexcel
npm run bank:build:edexcel
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work-edexcel --pdf-prefix=edexcel/

## Edexcel A-Level sciences

Added 23 October 2026: every question from Pearson Edexcel's A-Level and AS
Biology A (Salters-Nuffield, 9BN0/8BN0), Biology B (9BI0/8BI0), Chemistry
(9CH0/8CH0) and Physics (9PH0/8PH0) papers, June 2016 to June 2025, at
`/question-bank/edexcel-a-level-biology-a` and so on. The Edexcel past-paper pages
for those subjects now serve our own copies too, examiner's reports and Biology's
pre-release scientific articles included.

That is 7,142 question parts from 187 papers: Biology A 1,748, Biology B 1,826,
Chemistry 2,028 and Physics 1,540, each tagged to a sub-topic.

Gaps, honestly:
- Pearson published six June 2019 papers as scans (Physics AS 1 and 2, A-Level 1
  and 2, Chemistry Paper 2, Biology A Paper 3). Only the parts OCR read cleanly and
  the mark scheme confirms are in the bank (about 80 of some 200); the whole papers
  are in the library.
- Biology B's June 2017 AS Paper 1 examiner's report isn't published.
- Marks add up exactly for all but a handful of papers; the rest are a mark or two
  short where a part's mark sat outside its crop.

The pipeline lives in `scripts/question-bank/edexcel_sciences/`, beside the AQA one
and in the same shapes, so the site reads both alike:

- `fetch_pearson.py`: Pearson's past paper search lists every file of a
  specification; the file is downloaded unmodified. Pearson keeps the latest
  series for teachers only, so it arrives a year late. Pearson's search files the
  odd document under the wrong type; the file name (`que`, `rms`, `pef`) wins.
- `spec_pearson.py`: the topic tree. The specification's own topics are the tiles.
  Under them, Chemistry's lettered sub-topics (6A Alkanes) and Biology B's numbered
  ones (1.1 Carbohydrates); Biology A and Physics print only numbered statements,
  so `GROUPS` gathers those into sub-topics by statement number.
- `cut_pearson.py`: labels are found by order rather than position ("(b)" only
  after "(a)"), because Pearson's margins move between years. Older mark schemes
  are stored rotated, and are read and cropped as displayed. Six June 2019 papers
  were published as scans with no text: those are read with Apple's Vision OCR
  (`ocr.swift`, macOS only), and any part whose crop may have run into a missed
  label is left out.
- `tag_pearson.py` and `tag.md`'s Edexcel section: topic tagging, as for AQA.
- `build_pearson.py`: the data files, and `files-edexcel-sciences.json` for the library.

```bash
python3 scripts/question-bank/edexcel_sciences/fetch_pearson.py
python3 scripts/question-bank/edexcel_sciences/spec_pearson.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py      # --only=9ch001-jun26 for one paper
python3 scripts/question-bank/edexcel_sciences/tag_pearson.py split   # tag the new batches, then:
python3 scripts/question-bank/edexcel_sciences/tag_pearson.py merge
python3 scripts/question-bank/edexcel_sciences/build_pearson.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-sciences --papers=edexcel
```

## AQA GCSE Biology, Chemistry and Physics

`/question-bank/aqa-gcse-biology`, `-chemistry` and `-physics`, for "AQA GCSE
Physics questions by topic": every question from AQA's GCSE Biology (8461),
Chemistry (8462) and Physics (8463) papers, Foundation and Higher, June 2018 to
June 2025 plus the specimen papers. That is 4,902 question parts from 95 papers
(1,505 Biology, 1,744 Chemistry, 1,653 Physics), cut part by part exactly like the
A-Level ones, with their mark scheme rows and examiner's reports. Topics are the
specification's 86 numbered topics (4.1.1 Cell structure), with no year split.

- **Pipeline:** `scripts/question-bank/aqa_gcse/` runs the A-Level scripts over
  the GCSE specifications: `fetch_gcse.py` (fetch_aqa.py with GCSE pages and
  components), `spec_gcse.py` (spec.py for the `4.x` numbering), `cut.py` itself,
  and `build_gcse.py`, which also holds the short topic names used in page titles
  and addresses (`short` in the JSON) so every `<title>` stays under 60 characters.
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

## AQA GCSE Combined Science: Trilogy

`/question-bank/aqa-gcse-combined-science`, for "AQA GCSE Combined Science questions by
topic": every question from AQA's Combined Science: Trilogy (8464) papers, Foundation and
Higher, June 2018 to June 2025. That is 3,069 question parts from 86 papers, one bank for
all three sciences: Biology Paper 1 and 2, Chemistry Paper 1 and 2, Physics Paper 1 and 2,
each in two tiers. Every paper's parts add up to its 70 marks. Topics are the
specification's 61 numbered topics, by science: Biology 4.x, Chemistry 5.x, Physics 6.x.

- **Pipeline:** `scripts/question-bank/aqa_trilogy/`, the AQA GCSE scripts again.
  `fetch_trilogy.py` is fetch_aqa.py with Trilogy's file names (`8464B1F` for Biology
  Paper 1 Foundation, specimen papers as `84641B1F`). `spec_trilogy.py` reads the 4/5/6
  numbering. `cut_trilogy.py` is cut.py with two fixes kept to this bank, so no other
  bank's crops move: a question running over onto a page with an "Extra space" box (and
  its "[6 marks]") is no longer cut short, and a label whose point isn't bold ("0 3 . 1",
  Chemistry 2H November 2021) is read. `tag_trilogy.py` and `build_trilogy.py` follow.
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

## GCSE Maths, Higher tier (AQA, Edexcel and OCR)

Added 28 October 2026, after the founder asked for "maths higher gcse" (no board named, so
the three main English boards): `/question-bank/aqa-gcse-maths`, `/question-bank/edexcel-gcse-maths`
and `/question-bank/ocr-gcse-maths`, every Higher tier question from 2017 to 2025, November
series included.

| Bank | Papers | Series | Questions | Scheme crops | Reports |
| --- | --- | --- | --- | --- | --- |
| AQA 8300 | 1H (non-calculator), 2H, 3H | June 2017 to June 2025, with the specimen papers (16) | 1,304 | 1,304 | 1,134 |
| Pearson Edexcel 1MA1 | 1H (non-calculator), 2H, 3H | June 2017 to June 2025 (15) | 997 | 997 | 988 |
| OCR J560 | 4, 5 (non-calculator), 6 | June 2017 to June 2025 (15) | 921 | 920 | 647 |

Every AQA and Pearson paper's questions add up to its 80 marks; every OCR paper's to its
100, bar June 2024 Paper 6 (99: one question's mark is a point short).

- **Sources, all the boards' own sites.** AQA's and OCR's papers, schemes and reports are the
  past paper library's crawl of aqa.org.uk and ocr.org.uk (already on R2 under `aqa/` and
  `ocr/`; the banks link to those copies). Pearson's come from its past paper search:
  June 2019 on as single PDFs (on R2 under `edexcel/` from the library), June 2017 to
  November 2018 as one public zip per series of question papers and mark schemes and
  another of examiner's reports, which `fetch_gcse_maths.py` takes the Higher files out of
  (uploaded under `edexcel/1ma1-*`, with November 2020 Paper 2's report, which the library
  hadn't got).
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
  get no page (AQA 5, Edexcel 11, OCR 5 of the 97, such as A8 Coordinates on its own).
  Tagged by Claude subagents per tag.md's GCSE Maths section; `batch-31` holds the 18 OCR
  questions found after a re-cut (November 2019 Paper 5's questions 7–21, which OCR numbers
  in regular type, and June 2019 Paper 5's question 19) and was tagged by hand.
- **Calculator filter:** the bank's `calcPapers` turns the "Calculations" filter (which the
  maths banks otherwise leave out, `noCalc`) into "Calculator: Allowed / Not allowed";
  a question's `calc` says its paper allows one (AQA and Pearson Papers 2 and 3, OCR Papers
  4 and 6), and each paper's title in the filter says which it is. The URL stays `?calc=only`
  (calculator) or `?calc=none` (non-calculator).
- **Pipeline:** `scripts/question-bank/gcse_maths/`: `fetch_gcse_maths.py`, `spec_gcse_maths.py`,
  `cut_aqa_gcse_maths.py`, `cut_pearson_gcse_maths.py`, `tag_gcse_maths.py`, `build_gcse_maths.py`.
  Ids: `83001h-jun23-09`, `1ma11h-jun23-05`, `j56004-nov22-12`; crops under `bank/` with those names.

### Gaps

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
- **Scheme:** OCR November 2019 Paper 6 question 11 prints its rows "11 a" in a way the
  cutter doesn't read; it links to the whole mark scheme instead.
- None of the three boards puts older Higher papers behind a teacher login (Pearson's 2017
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
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/gcse-maths/aqa --crops-only   # and edexcel, ocr
```

## Edexcel GCSE Biology, Chemistry and Physics

`/question-bank/edexcel-gcse-biology`, `-chemistry` and `-physics`, added 28 October 2026
after a student asked for "GCSE Edexcel Triple Science": every question from Pearson
Edexcel's GCSE (9–1) Biology (1BI0), Chemistry (1CH0) and Physics (1PH0) papers,
Foundation and Higher (1F, 1H, 2F, 2H), June 2018 to June 2025 with November 2020 and
2021, plus the Biology and Chemistry specimen papers. That is 5,268 question parts from
104 papers (Biology 1,834, Chemistry 1,880, Physics 1,554), cut part by part with their
mark scheme rows and examiner's reports. Every paper's parts add up to its 100 marks.
The paper filter is the tier filter ("Paper 1 Higher"), as in the AQA GCSE banks.

- **Source papers:** Pearson's own site only. `fetch_gcse.py` reads Pearson's past paper
  search (the sciences share the code `gcse16-science`) for November 2020 onwards; June
  2018 and 2019 come as one zip per subject and tier from the same search; the specimens
  are split out of each subject's "Sample assessment materials" book by its contents
  page. Pearson's server drops long downloads part way, so files are fetched with curl.
  Whole papers are on R2 under `edexcel/` (`1ph0-2h-qp-jun24.pdf`), crops under `bank/`.
- **Topics:** Pearson prints only numbered statements under each topic (2.1 … 2.33P), so
  `spec_gcse.py` groups them into sub-topics (`GROUPS`: 42 Biology, 38 Chemistry, 46
  Physics), as `spec_pearson.py` does for A-Level Biology A and Physics. A sub-topic shows
  its statement numbers (`points`), and the tiles are the specification's topics.
- **Cutting:** `cut_gcse.py` runs `cut_pearson.py` unchanged, with two GCSE-only patches so no
  other bank's crops move: a scheme table headed "Question Answer" on one line (Physics 2F
  June 2024), and a row marked once for a question on both tiers, labelled "8c(i)(F)" over
  "2(ai)(H)": each scheme keeps its own tier's number.
- **Tags:** every part was tagged by Claude following `tag.md` ("Edexcel GCSE sciences").
- **Practicals:** `practicals.py` and `bankHasPracticals` already count any Biology,
  Chemistry or Physics bank; the parts were judged as for the others.

Gaps, honestly:
- June 2026 is for teachers only on Pearson's site, so the bank stops at June 2025.
- Physics's specimen papers aren't in: Pearson's book is a 158 MB scan whose text
  layer is unreadable OCR.
- Chemistry 1F and Physics 1F June 2019 are scans. OCR missed their boxed question
  numbers, so their labels were set from the OCR'd part labels and each "(Total for
  Question N …)" line (`labels/1ch01f-jun19.json`, `labels/1ph01f-jun19.json`), checked
  row for row against their mark schemes; one mark on each, and one on Chemistry 1F
  June 2025, was read off the scheme. Scanned crops keep the scan's blank answer space.
- 41 parts (0.8%) link to the whole mark scheme instead of a cropped row, mostly
  six-mark questions whose scheme row the cutter didn't find.
- Foundation and Higher papers share questions, so those appear twice, once per tier.
- Combined Science (1SC0) isn't in: it is the same pipeline with twelve papers a series.
- The past paper library's Edexcel GCSE science pages still list their older copies;
  `build_gcse.py` doesn't write a library file yet.

```bash
python3 scripts/question-bank/edexcel_gcse/fetch_gcse.py
python3 scripts/question-bank/edexcel_gcse/spec_gcse.py
python3 scripts/question-bank/edexcel_gcse/cut_gcse.py          # --only=1ph02h-jun26 for one paper
python3 scripts/question-bank/edexcel_gcse/tag_gcse.py split    # tag the new batches, then:
python3 scripts/question-bank/edexcel_gcse/tag_gcse.py merge
python3 scripts/question-bank/edexcel_gcse/build_gcse.py
python3 scripts/question-bank/practicals.py split --only=edexcel-gcse-biology,edexcel-gcse-chemistry,edexcel-gcse-physics --parts=scripts/question-bank/.work/edexcel-gcse/parts.json   # judge, then merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse --pdf-prefix=edexcel/
```

## OCR and OCR MEI

Added 25 October 2026, after the bank's video went viral and students asked for OCR:

| Bank | Specifications | Unit |
| --- | --- | --- |
| `/question-bank/ocr-a-level-biology-a` | H420, AS H020 | part |
| `/question-bank/ocr-a-level-chemistry-a` | H432, AS H032 | part |
| `/question-bank/ocr-a-level-physics-a` | H556, AS H156 | part |
| `/question-bank/ocr-a-level-biology-b` | Biology B (Advancing Biology) H422, AS H022 | part |
| `/question-bank/ocr-a-level-chemistry-b` | Chemistry B (Salters) H433, AS H033 | part |
| `/question-bank/ocr-a-level-physics-b` | Physics B (Advancing Physics) H557, AS H157 | part |
| `/question-bank/ocr-a-level-maths` | H240, AS H230 | whole question |
| `/question-bank/ocr-a-level-further-maths` | H245 (Y540-Y545), AS H235 | whole question |
| `/question-bank/ocr-mei-a-level-maths` | H640, AS H630 | whole question |
| `/question-bank/ocr-mei-a-level-further-maths` | H645 (Y420-Y436), AS H635 | whole question |

Sciences run June 2016 (AS) / 2017 (A-Level) to June 2025; maths June 2018 to June
2025 (A-Level Further Maths from June 2019). OCR keeps the newest series on Teach
Cambridge, for teachers, so June 2026 arrives a year late.

- **Papers:** the past paper library's OCR fetcher (`scripts/past-papers/boards/ocr.py`)
  already downloads every OCR paper. `ocr/fetch_ocr.py` (and `--maths`) copies the
  ones the bank needs from its work folder, and the bank's "whole paper" links are the
  library's own R2 keys (`ocr/OCR-H432-01-QP-JUN24.pdf`), so nothing is stored twice.
- **Topics:** sciences from OCR's specifications (`ocr/spec_ocr.py`): sections ("3.1
  The periodic table") as tiles and numbered topics ("3.1.2 Group 2") under them, Year
  1 = Modules 2-4. Maths uses the Edexcel maths bank's topics (`edexcel_topics.json`):
  A-Level Maths content is the same for every board.
- **Cutting:** `edexcel_sciences/cut_pearson.py` reads OCR's layout too: marks printed
  "[3]", scheme labels split across columns ("16" | "(a)" | "(i)", or bare "a" | "i"),
  "(ii)" rows carrying on the part above, a multiple-choice table under one header.
  Maths is cut with `--whole`: a question at a time with all its scheme rows.
- **Tagging:** `ocr/tag_ocr.py` (sciences) and `ocr/maths_ocr.py split|merge` (maths),
  briefed by tag.md's OCR section.
- **Building:** `ocr/build_ocr.py` and `ocr/maths_ocr.py build`.

Gaps, after the fixes of 25 October 2026 (below): every OCR science paper's marks
add up exactly, and every Maths paper's too. OCR publishes no mark scheme for Maths
H240/01 June 2018 or MEI Further Maths Y433/01 June 2023, so those 19 questions link
none. 38 science parts and 2 maths questions still link the whole scheme instead of a
cropped row, where the scheme's table is set in a way the cutter can't read.

Fixed on 25 October 2026:
- **Biology A Paper 2, November 2020** is a scan whose labels OCR's text reading
  misread, so only 6 of its parts got in. Its labels are now set by hand, read off
  the paper page by page (`labels/h42002-nov20.json`; `cut_pearson.py` reads a set's
  labels from `scripts/question-bank/labels/<set>.json` when there is one). All 54 parts
  (100 marks) are in, each with its own scheme rows, multiple-choice answers from the
  scheme's table.
- **Biology A AS Paper 2, November 2020**: OCR's listed mark scheme is another paper's.
  The right one is published at `643848-mark-scheme-depth-in-biology.pdf` (its running
  header wrongly says H420/02); 29 of the 30 parts now have their scheme rows, and the
  PDF is on R2 at the library's key, `ocr/OCR-H020-02-MS-NOV20.pdf`.
- **Marks that weren't read:** a "[1]" at the very foot of a page, just above OCR's
  footer, now counts for its part. That completed seven science papers. MEI Maths
  Paper 3 June 2018's Q2 prints its mark above its own label, so it is set in
  `labels/h64003-jun18.json`.
- **Scheme rows:** a row the scheme labels "16 (ii)" (its letter dropped) or "16(b)(k)" (a
  roman the font garbled) is now read as the part after the row above. A label read twice
  keeps the copy with a row under it. Physics A Paper 3 June 2017's scheme prints "(a)"
  without its letter, so its five rows are mapped in `labels/h55603-jun17.json`.

```bash
python3 scripts/question-bank/ocr/fetch_ocr.py [--maths]
python3 scripts/question-bank/ocr/spec_ocr.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/ocr-sciences
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/ocr-maths --whole
python3 scripts/question-bank/ocr/tag_ocr.py split    # tag, then: tag_ocr.py merge
python3 scripts/question-bank/ocr/maths_ocr.py split  # tag, then: maths_ocr.py merge
python3 scripts/question-bank/ocr/build_ocr.py && python3 scripts/question-bank/ocr/maths_ocr.py build
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-sciences --crops-only   # the PDFs are the library's
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-maths --crops-only
```

### OCR B sciences

Added 25 October 2026, when a student asked for them: Biology B, Chemistry B (Salters)
and Physics B, June 2016 (AS) / 2017 (A-Level) to June 2025, 5,819 parts from 139
papers: Biology B 1,889, Chemistry B 2,049, Physics B 1,881, every one tagged, and 708
marked practical (206, 215, 287). The same pipeline with `--b`, in `.work/ocr-b-sciences`:

- **Topics** (`ocr/spec_ocr_b.py`): Biology B as Biology A (sections as tiles, numbered
  topics, Year 1 = Modules 2-3). Chemistry B's ten storylines are the tiles (the first
  five are AS), and the chemical ideas each one's learning outcomes are grouped under
  are its topics, shown with the storyline's code ("EL Atomic structure",
  specification points EL(e)–(h)). Physics B's modules are the tiles and its numbered
  units the topics (3.1.2 Sensing, 4.2 Space, time and motion, plus Module 2's
  Fundamental data analysis); Year 1 = Modules 2-4.
- **Cutting:** Chemistry B's multiple-choice keys are a narrow table of their own
  ("Question | Key | AO", "Q | Key", "No. AO | Key"), sometimes mid-page; the cutter
  reads those rows a line at a time. A few typeset papers carry a page or six as
  pictures with no text: those pages alone are read by OCR at ~290 dpi. OCR B's schemes
  print their running head along the foot of the page; scheme crops stop above it.
- **Tagging:** `tag_ocr.py split --b` / `merge --b`, briefed by tag.md's "OCR B sciences".

Gaps: OCR doesn't publish June 2023 for Biology B AS. Two mark scheme links on OCR's
site serve another paper's scheme (Biology B November 2020 Paper 1, AS June 2025
Paper 2), so those 96 parts link no scheme; the June 2017 Biology B examiners' report
covers every paper at once and isn't split by question. H157/01 June 2025's scheme
leaves out questions 4 and 8. Marks add up exactly for 137 of 139 papers; Biology B
June 2019 Paper 1 and June 2017 Paper 3 are each one mark short, where a "[1]" sits on
a page's last line.

```bash
python3 scripts/question-bank/ocr/fetch_ocr.py --b --from=<the library's .work/ocr>
python3 scripts/question-bank/ocr/spec_ocr_b.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/ocr-b-sciences
python3 scripts/question-bank/ocr/tag_ocr.py split --b    # tag, then: tag_ocr.py merge --b
python3 scripts/question-bank/ocr/build_ocr.py --b
python3 scripts/question-bank/practicals.py split --parts=scripts/question-bank/.work/ocr-b-sciences/parts.json \
  --only=ocr-a-level-biology-b,ocr-a-level-chemistry-b,ocr-a-level-physics-b   # judge, then: practicals.py merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-b-sciences --crops-only
```

**Crop version 3 (26 October 2026).** The OCR banks were re-cut again with the merged cutter:
#28's rule-based scheme rows (whole rows, no slivers of the row above), and no labels before
a scheme's first table (MEI's numbered marking instructions had been read as question 5's
scheme). Where the new cut found no scheme but the live data had a real one, the live crop
was kept; four live crops that were only slivers ("Question Answer Marks Guidance") now
link the whole scheme instead.

**Re-cut 26 October 2026 (crop version 2).** A paper's last scheme crop ran on to OCR's back
pages ("Need to get in touch?", the company notice, blank pages, and in older schemes a
contact block under the last answer). `cut_pearson.py` now stops at them (`BACK_PAGE`,
`BACK_BLOCK`). All ten OCR banks were re-cut from their work folders and rebuilt: no part,
tag or mark lost; 444 OCR A multiple-choice parts gained their answer; scheme crops lost
OCR's running heads and footers. Crops are cached as immutable, so a re-cut bank carries
`cropVersion` (set in `ocr/build_ocr.py`, `CROP_VERSION`) and its crop URLs ask for
`?v=<version>`: bump it whenever a bank's crops are re-uploaded under the same names.

## AQA A-Level Psychology

Added 25 October 2026, after a student asked for it: `/question-bank/aqa-a-level-psychology`,
every question from AQA's A-Level (7182, Papers 1–3) and AS (7181, Papers 1–2)
Psychology papers that AQA still publishes, November 2020 to June 2025. That is 669
questions from 27 papers, every one with its mark scheme cropped (for an essay, the
whole levels table and the possible content) and 498 with the examiner's comments.

- **Topics:** the specification's A-Level topics, arranged as the papers are: Paper 1's
  four, Paper 2's Approaches, Biopsychology and Research methods (split into its four:
  methods, scientific processes, data handling and analysis, inferential testing),
  Issues and debates, and the nine Paper 3 options in three tiles ("Paper 3 options").
  A Paper 3 option question always carries its option's topic.
- **Pipeline:** `scripts/question-bank/aqa_psychology/`, the AQA scripts with
  Psychology's differences: `fetch_psychology.py` (fetch_aqa.py over 7181/7182),
  `spec_psychology.py`, `cut_psychology.py` (cut.py, with mark schemes read as text
  rather than tables, section headings left out, and a question's scenario or table
  moved down to it when it is printed above its label), `tag_psychology.py` (briefed
  by tag.md's AQA Psychology section) and `build_psychology.py`. Papers are on R2
  under `aqa/`, crops under `bank/`.
- **Gaps:** AQA no longer publishes June 2017–2019, so the bank starts at November
  2020. AS Paper 2 June 2025's question paper isn't published (its scheme is). The
  specimen papers are left out (cut.py can't read their labels). The November 2020
  and 2021 Paper 3 reports don't comment question by question, AQA published no
  November 2020 AS reports, and some reports discuss only selected questions, so
  171 questions have no examiner's report. There is no past paper
  library page for Psychology yet, so the bank's "whole papers" credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_psychology/fetch_psychology.py
python3 scripts/question-bank/aqa_psychology/spec_psychology.py
python3 scripts/question-bank/aqa_psychology/cut_psychology.py
python3 scripts/question-bank/aqa_psychology/tag_psychology.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_psychology/tag_psychology.py merge
python3 scripts/question-bank/aqa_psychology/build_psychology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-psychology
```

## AQA A-Level Maths

Added 26 October 2026, after students asked for it (AQA had no maths in the bank):
`/question-bank/aqa-a-level-maths`, every question from AQA's A-Level Mathematics (7357)
Papers 1–3, every series AQA has sat: June 2018 and 2019, November 2020 and 2021, June
2022 to June 2025. That is 426 questions from 24 papers, each paper's questions adding up
to its 100 marks, every one with its mark scheme rows cropped, and all but two with the
examiner's comments.

- **Cut a whole question at a time, like the other maths banks:** a question's words,
  label by label ("9", "9 (a)", "9 (a) (ii)"), each stopping where its answer lines
  start, stacked into one crop without the space to write in. Its scheme crop is the
  table's rows from its first label to the next question's (June 2018 prints "(b)"
  without its number), with the column headings where the scheme prints them over it.
- **Topics:** the specification's 19 lettered sections, A Proof to S Moments (there is
  no T), under Pure (A–J), Statistics (K–O) and Mechanics (P–S), shown with their
  letters ("G Differentiation"), as the other maths banks show Pure 1–10. Section codes
  are `Pure`, `Stats` and `Mech`, not letters: the topic filter takes section and topic
  codes alike, and M, P and S are topics. No question's marks are mainly for P
  (Quantities and units), so it has no page.
- **Text:** the papers' maths fonts put symbols at odd codes in the text layer ("y ¼ 2x þ 1"),
  a different set per font; `cut_maths.py` reads them back per font for search, tagging
  and the opening words.
- **Pipeline:** `scripts/question-bank/aqa_maths/`: `fetch_maths.py` (fetch_aqa.py over
  7357), `spec_maths.py` (the topics from AQA's specification PDF), `cut_maths.py`,
  `tag_maths.py` (briefed by tag.md's AQA Maths section) and `build_maths.py`. AQA's
  own papers were already on R2 under `aqa/` (the library's copies, byte for byte the
  same); crops are under `bank/7357*`. The bank was first cut part by part, so R2 also
  holds part and stem crops (`bank/73571-jun23-09-aii-qp.webp`, `-09-stem.webp`) nothing links to;
  a single-part question's crops are the same file both ways.
- **Gaps:** none in the papers: AQA publishes every series, scheme and report. Its
  reports say nothing on June 2018 Paper 1 question 14 or November 2020 Paper 2
  question 11. The specimen papers are left out, as for the other AQA banks.

```bash
python3 scripts/question-bank/aqa_maths/fetch_maths.py
python3 scripts/question-bank/aqa_maths/spec_maths.py <AQA's 7357 specification PDF>
python3 scripts/question-bank/aqa_maths/cut_maths.py
python3 scripts/question-bank/aqa_maths/tag_maths.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_maths/tag_maths.py merge
python3 scripts/question-bank/aqa_maths/build_maths.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-maths --crops-only
```

## Edexcel A-Level Economics A

Added 25 October 2026, after a student asked for it: `/question-bank/edexcel-a-level-economics-a`,
every question from Pearson's A-Level (9EC0, Papers 1–3) and AS (8EC0, Papers 1–2)
Economics A papers that Pearson publishes, June 2016 to June 2025 (June 2026 is for
teachers only). That is 784 parts from 45 papers, every one with its mark scheme and
738 with the examiner's comments.

- **Topics:** the specification's numbered topics as tiles ("1.2 How markets work") and
  their sub-topics under them ("1.2.3 Price, income and cross elasticities of demand");
  themes 1–2 are Year 1 · AS, themes 3–4 Year 2 (`edexcel_economics/spec_economics.py`).
- **Extracts:** Section B and Paper 3 questions are set on two or three pages of figures
  and extracts printed before the question. `cut_pearson.py --extracts` attaches them to
  the question's stem ("Show how question 6 starts"), from the "Read the following
  extracts…" line to the question. From June 2025 the extracts are in a source booklet
  bound in at the back of the question paper: a "Read … in the Source Booklet" question
  takes the booklet's "Sources for use with SECTION B" block. The PDF builder slices a crop taller than a page
  across pages rather than shrinking it.
- **What `--extracts` also changes** (economics only; the sciences cut as before):
  a part's crop ends under its marks, its "(Total for Question 8 = 25 marks)", or above
  the "OR" of an essay choice, not pages of answer lines later; parts listed together and
  then printed again above their answer spaces end where the repeats begin, and take
  their marks from the repeat when the list has none; the even pages' bold page numbers
  at the left aren't question numbers; a question number with no text (June 2017
  Paper 2's "6") is inferred from its "(a)" straight after the extracts; mark schemes run
  on over pages of empty table borders into the levels grids, with the blank stretches
  closed up; and the reports' "Question 1 (a):", "1a", "1(a)" and "Question 6a asked…"
  headings are read.
- **Pipeline:** `edexcel_economics/` holds thin wrappers over the Pearson scripts:
  `fetch_economics.py`, `spec_economics.py`, `tag_economics.py` (tag.md's "Edexcel
  Economics A" section) and `build_economics.py`. Papers are on R2 under `edexcel/`,
  crops under `bank/`.
- **Gaps:** June 2024 Paper 3's examiner report has no readable text (its font carries no
  text mapping), so its 10 parts have no comments. One part, AS Paper 2 June 2019 5(b)(ii),
  has no marks of its own (its "(2)" covers 5(b) as a whole). There's no past paper library
  page for Economics yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/edexcel_economics/fetch_economics.py
python3 scripts/question-bank/edexcel_economics/spec_economics.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/edexcel-economics --extracts
python3 scripts/question-bank/edexcel_economics/tag_economics.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_economics/tag_economics.py merge
python3 scripts/question-bank/edexcel_economics/build_economics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-economics --pdf-prefix=edexcel/
```

## Edexcel A-Level Geography

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

## Edexcel A-Level Psychology

Added 27 October 2026, after a student asked for it: `/question-bank/edexcel-a-level-psychology`,
every question from Pearson Edexcel's A-Level (9PS0, Papers 1–3) and AS (8PS0, Papers 1–2)
Psychology papers that Pearson publishes, June 2016 to June 2025. That is 946 parts from 45
papers, each with its mark scheme cropped (levels grids whole), and 466 with the examiner's
comments. Every paper's parts add up to its printed total (`check_psychology.py`).

- **Topics** are the specification's nine (Social, Cognitive, Biological, Learning theories,
  Clinical, the three Paper 2 options Criminological, Child and Health, and Psychological
  skills), each split into its own parts: Content, Methods, Studies, Key questions,
  Practical investigation, Issues and debates. Those names repeat, so each topic's page
  title and address use a `short` ("Social psychology studies"). Topics 1–4 are Year 1
  (the AS), the rest Year 2.
- **Paper 2's options** are whole questions (Section B, one of three), so, as in the
  Geography banks, no part is marked `or`: each option's questions are tagged only to its
  own topic (`tag_psychology.py` reads which questions sit under which option off each
  paper's headings, and its merge refuses a tag outside them).
- **Cutting:** `cut_psychology.py` runs `cut_pearson.py --extracts --figures`. Geography's
  `--figures` mode stops a scheme's page number being read as a question's row (15 schemes
  had been another question's) and keeps levels grids' "0" row and tables to complete.
  The wrapper also treats the statistical tables Pearson prints before Question 1 since
  2024 as blank pages. A-Level Paper 1 June 2019 is a scan: its labels are in
  `labels/9ps001-jun19.json`, so its 12-mark essay (Q12) is kept.
- **Tags:** Claude tagged every part following `tag.md`'s "Edexcel Psychology" section.

```bash
python3 scripts/question-bank/edexcel_psychology/fetch_psychology.py
python3 scripts/question-bank/edexcel_psychology/spec_psychology.py
python3 scripts/question-bank/edexcel_psychology/cut_psychology.py
python3 scripts/question-bank/edexcel_psychology/check_psychology.py
python3 scripts/question-bank/edexcel_psychology/tag_psychology.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_psychology/tag_psychology.py merge
python3 scripts/question-bank/edexcel_psychology/build_psychology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-psychology --pdf-prefix=edexcel/

## AQA A-Level Geography

Added 27 October 2026: `/question-bank/aqa-a-level-geography`, every question from AQA's
A-Level (7037, Papers 1–2) and AS (7036, Papers 1–2) Geography papers that AQA still
publishes, November 2020 to June 2025. That is 537 parts from 22 papers, every one with
its mark scheme cropped and tagged to a topic, and 405 with the examiner's comments.

- **Parts, each with its setup and figures.** AQA numbers parts (`01.3`), so each is a
  crop, as in the AQA sciences: the lines that set it up ("Figure 2 is in the insert.
  Figure 2 shows…", or a figure printed in the paper), then its label and words down to
  its marks, with what's printed under the marks before the answer space (an AS
  multiple-choice part's options, a table to complete). The answer lines, "Extra space"
  and the section and question headings are left out. The A-Level papers print most
  figures in a colour insert: a part that names one has it in its crop, between its
  setup and its label (106 parts), so a part shown alone under a topic still has its
  figure. Insert figures run from their bold caption to the next; a page printed
  sideways is turned upright. AS Paper 2's fieldwork scenarios ("0 3", a bare label) are
  their question's stem (`70362-jun24-03-stem.webp`).
- **Options.** A-Level Paper 1 is water and carbon cycles, one of hot deserts, coasts and
  glaciers, and one of hazards and ecosystems under stress; Paper 2 is global systems,
  changing places, and one of urban environments, population and the environment, and
  resource security. AS Paper 1 is one of water and carbon, coasts and glaciers, and one
  of hazards and urban environments; AS Paper 2 is changing places, a fieldwork question,
  and one of two fieldwork scenarios. Each option is its own area (tile) and its parts are
  tagged only to that area: `tag_geography.py merge` rejects any code outside the area
  the question is printed in. As in the Edexcel Geography bank, no part is marked `or`:
  the choices are whole questions, and `or` on a whole question would leave its card with
  no marks. `check_geography.py` checks every paper's total instead, counting one question
  of each choice and requiring a choice's questions to carry the same marks: all 22 add up
  (120 for A-Level, 80 for AS, 65 for the shortened AS Paper 2 of June 2022).
- **Mark schemes:** tables whose rows are labelled in two cells (`01` | `3`); a part's
  scheme runs from its row to the next part's, so a 20-mark question's "Marking grid for
  Question 01.4", printed after its notes, comes whole with it (the cutter checks every
  20-mark scheme has its Level 4 and every 9-mark or longer one its levels).
- **Examiner's reports** are keyed by question. Some are headed by question ("Question 1",
  "Question 01.2"); others are written by question type ("6-mark AO3 questions … Q1.3 and
  Q5.3"), and every paragraph that names a part is kept for that part's question.
- **Topics:** the specification's areas as tiles (`3.1.1 Water and carbon cycles` …
  `3.2.5 Resource security`) and their numbered topics (`3.1.1.2 The water cycle`), with
  a last tile for AS Paper 2's fieldwork (planning, collecting, presenting, analysing,
  concluding; the specification doesn't number these, so their codes aren't shown). The
  areas the AS covers are Year 1 · AS; hot deserts, ecosystems, global systems, population
  and resources are Year 2 (`aqa_geography/spec_geography.py`). AS questions use the
  A-Level codes.
- **Pipeline:** `scripts/question-bank/aqa_geography/`: `fetch_geography.py` (fetch_aqa.py
  over 7036/7037, inserts included), `spec_geography.py`, `cut_geography.py` (its own
  layout around cut.py's image helpers; cut.py is unchanged), `check_geography.py`,
  `tag_geography.py` (briefed by tag.md's AQA Geography section) and `build_geography.py`.
  Papers are on R2 under `aqa/`, crops under `bank/7036*`, `bank/7037*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (the AS) or June 2018–2019 (the
  A-Level), and sat no AS papers in November 2021, so the bank starts at November 2020.
  The specimen papers are left out, as for the other AQA banks. Component 3 (the NEA,
  the fieldwork investigation) is coursework, so there's nothing to cut. AQA published no
  reports for the November 2020 AS papers or the November 2021 A-Level papers, and its
  A-Level Paper 1 reports for November 2020, June 2023 and June 2024 are written by
  question type and name only some questions, so the rest have none. Some figures are
  withheld for copyright in AQA's own copies (its "-CR" inserts and papers: June 2025
  Paper 2's Figure 3, November 2021 Paper 2's access to clean water graph), so those
  parts show AQA's notice instead. AQA's November 2020 AS scheme prints no levels for question
  02.5. There's no past paper library page for AQA Geography yet, so the credit links to
  `/past-papers`.

```bash
python3 scripts/question-bank/aqa_geography/fetch_geography.py
python3 scripts/question-bank/aqa_geography/spec_geography.py
python3 scripts/question-bank/aqa_geography/cut_geography.py
python3 scripts/question-bank/aqa_geography/check_geography.py
python3 scripts/question-bank/aqa_geography/tag_geography.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_geography/tag_geography.py merge
python3 scripts/question-bank/aqa_geography/build_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-geography
```

## AQA A-Level Economics

Added 26 October 2026, after a student asked for it: `/question-bank/aqa-a-level-economics`,
every question from AQA's A-Level (7136, Papers 1–3) and AS (7135, Papers 1–2) Economics
papers that AQA still publishes, November 2020 to June 2025. That is 686 questions from 28
papers, every one with its mark scheme cropped or its multiple-choice answer, and 274 with
the examiner's comments.

- **Whole questions, grouped by choice.** AQA numbers whole questions (`04`), so each is
  one crop, ending at its marks (the answer book's lines and pages are left out). The
  papers are choices: A-Level Papers 1 and 2 are EITHER Context 1 (01–04) OR Context 2
  (05–08), then one essay of three (09–10, 11–12, 13–14); AS Papers 1 and 2 are 20
  multiple-choice questions, then EITHER Context 1 (21–26) OR Context 2 (27–32); Paper 3
  is 30 multiple-choice questions and an investigation (31–33). A question's id names
  its group (`71361-jun24-c1-04`, `-e2-11`, `-a-05`, `-b-31`), and the group's stem is
  shared: a context's extracts (from the insert, for AS), an essay's opening passage,
  or the investigation's scenario and the insert's extracts. The site finds the stem by
  dropping the id's last part, so "Show how question 04 starts" opens Context 1's
  extracts, and a downloaded set prints each stem once, above the first question that
  uses it (`questionSetPdf.ts` now skips a stem it has already drawn, by image).
- **Either/or.** Context 2's questions and Essays 2 and 3 carry `or`, so a paper's marks
  count one context and one essay, as a candidate answers it: every paper adds up to its
  80 (A-Level) or 70 (AS) marks. The stems begin with "Context 2", "Essay 3", so the
  choice is on the page.
- **Mark schemes:** each question's guidance, from its label to "MAXIMUM FOR QUESTION 04".
  Most 15- and 25-mark questions use a levels-of-response grid printed once per section
  ("Use the level mark scheme on page 4"): it is cut once and stacked under each of
  those questions, so no essay scheme is shown without its levels. (AQA's page
  references are sometimes a page out; the grid is matched by its marks.) Paper 3 and
  the 9- and 10-mark questions print their own grid. Multiple-choice answers are read
  from the scheme's KEY LIST (`k`); November 2021 Paper 3 question 20 accepts "A or C".
- **Topics:** the specification's numbered A-Level topics as tiles ("4.1.5 Perfect
  competition, imperfectly competitive markets and monopoly") and their sub-topics under
  them ("4.1.5.7 Price discrimination"); a sub-topic the AS content also has is Year 1 ·
  AS (`aqa_economics/spec_economics.py`). AS questions are tagged with AS sub-topics only.
- **Pipeline:** `scripts/question-bank/aqa_economics/`: `fetch_economics.py` (fetch_aqa.py
  over 7135/7136, inserts included), `spec_economics.py`, `cut_economics.py` (its own
  layout around cut.py's label finder and image helpers; cut.py is unchanged),
  `tag_economics.py` (tag_pearson.py, briefed by tag.md's AQA Economics section) and
  `build_economics.py`. Papers are on R2 under `aqa/`, crops under `bank/71351*`–`bank/71363*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (its file store has none of them), and
  sat no AS papers in November 2021, so the bank starts at November 2020. The specimen
  papers are left out, as for the other AQA banks. AQA published no reports for November
  2021, AS November 2020 or Paper 3 June 2024, and its Paper 3 reports comment on a few
  multiple-choice questions only. Some extracts are withheld for copyright in AQA's own
  copies: June 2022 Paper 2's Figures 3 and 4, June 2023 Paper 3's Figure 6 and November
  2020 Paper 3's Figure 4. There's no past paper library page for AQA Economics yet, so
  the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_economics/fetch_economics.py
python3 scripts/question-bank/aqa_economics/spec_economics.py
python3 scripts/question-bank/aqa_economics/cut_economics.py
python3 scripts/question-bank/aqa_economics/tag_economics.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_economics/tag_economics.py merge
python3 scripts/question-bank/aqa_economics/build_economics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-economics
```

## AQA A-Level Business

Added 27 October 2026, after a student asked for it: `/question-bank/aqa-a-level-business`,
every question from AQA's A-Level (7132, Papers 1–3) and AS (7131, Papers 1–2) Business
papers that AQA still publishes, November 2020 to June 2025. That is 393 questions from 28
papers, every one with its mark scheme cropped or its multiple-choice answer, tagged to a
topic, and 204 with the examiner's comments.

- **Questions and parts.** A-Level Paper 1 is 15 multiple-choice questions, short answers
  (16–20; November 2021 sets two of them on data with parts, 16.1–16.4 and 17.1–17.2), then
  EITHER/OR essays in Sections C and D. Paper 2 is three cases, each its text and appendices
  then its parts (01.1–01.5). Paper 3 and AS Paper 2 are one case study, printed in the
  insert, and six or eight whole questions on it. AS Paper 1 is 10 multiple-choice
  questions, short answers 11–15, then two short cases with parts (16.1, 16.2, 17.1, 17.2).
  So ids are cut.py's own (`71322-jun24-01-3`, `71321-jun24-18`), and a question ends at its
  marks (the answer lines and pages are left out); multiple choice runs to the next label,
  so its options stay with it.
- **Case material as stems.** A part's stem is its question's case, from the question's
  label to its first part (`71322-jun24-01-stem.webp`), so "Show how question 01 starts"
  opens the case and its appendices. Paper 3's and AS Paper 2's questions share the insert's
  case study as one stem (`71323-jun24-stem.webp`, every page up to "END OF SOURCE"). A few
  papers print data several questions use ("Questions 16, 17 and 18 are based on the data
  provided in Table 1"): where it sits above the first question's label every member shares
  it as `<set>-stem.webp`; where it sits beside the first label ("1 4  Questions 14 and 15 are
  based on the network below"), the first question keeps it in its own crop and the others
  share it. A downloaded set prints each stem once.
- **Either/or.** The second essay of each pair in A-Level Paper 1's Sections C and D
  ("OR", lower case in 2021 and 2022) carries `or`, so every A-Level paper adds up to its 100
  marks and every AS paper to its 80.
- **Mark schemes:** not tables: each question is its label, its words again, its own
  levels-of-response grid and indicative content, up to the next label. Every grid is
  printed with its question, so none is shared and none is cut apart from it (a grid that
  runs over a page is two pieces of one crop). The header and footer rules, which even pages
  draw from the left edge, are left out. Multiple-choice answers come from Section A's
  "Question number / Answer" table (`k`).
- **Reports:** headed "Question 16", "Question 16.1", "Q16:" (Paper 1, 2022–23) or just
  "1.1"; a whole question's comments are gathered under it, each part headed by its label,
  as the other AQA science banks key them. Paper 3's reports from 2023 open with a contents
  list and quote student answers as images; the examiner's commentary on them is kept.
- **Topics:** the specification's ten areas as tiles (`3.1 What is business?` …
  `3.10 Managing strategic change`) and their 42 numbered topics under them ("3.7.2
  Analysing the existing internal position of a business to assess strengths and
  weaknesses: financial ratio analysis", shown short where the title is long: "Financial
  ratio analysis"). 3.1–3.6 are the AS content (Year 1 · AS), 3.7–3.10 A-Level only. The
  tree is read from the current specification (version 2.0, June 2023, linked from AQA's
  7132 page), whose numbering is the 2015 one's. AS questions are tagged with AS topics only.
- **Pipeline:** `scripts/question-bank/aqa_business/`: `fetch_business.py` (fetch_aqa.py
  over 7131/7132, inserts included), `spec_business.py`, `cut_business.py` (cut_economics.py's
  page frames and spans, with Business's own layout; cut.py and cut_economics.py are
  unchanged), `tag_business.py` (tag_pearson.py, briefed by tag.md's AQA Business section)
  and `build_business.py`. Papers are on R2 under `aqa/`, crops under `bank/7131*`, `bank/7132*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (its file store has none of them), and
  sat no AS papers in November 2021, so the bank starts at November 2020. The specimen
  papers are left out, as for the other AQA banks. AQA published no reports for November
  2021 or AS November 2020. There's no past paper library page for AQA Business yet, so the
  credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_business/fetch_business.py
python3 scripts/question-bank/aqa_business/spec_business.py
python3 scripts/question-bank/aqa_business/cut_business.py
python3 scripts/question-bank/aqa_business/tag_business.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_business/tag_business.py merge
python3 scripts/question-bank/aqa_business/build_business.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-business
```

## AQA A-Level Philosophy

Added 27 October 2026, after a student asked for it: `/question-bank/aqa-a-level-philosophy`,
every question from AQA's A-Level Philosophy (7172, Papers 1 and 2) papers that AQA still
publishes, November 2020 to June 2025. That is 120 questions from 12 papers, every one
with its mark scheme cropped whole (the levels-of-response grid and the indicative
content, across pages) and 70 with the examiner's comments. Every paper's marks add up
to its 100.

- **Whole questions.** Each paper is two areas of five questions: 3, 5, 5, 12 and 25
  marks (Paper 1: Epistemology 01–05, Moral philosophy 06–10; Paper 2: Metaphysics of
  God 01–05, Metaphysics of mind 06–10). A question is one crop, ending at its marks:
  the answer lines under it are left out, so a 25-mark essay is a one-line crop.
  Ids are `71721-jun24-05`; reports are keyed by question (`reportsBy` "question").
  No question is a calculation, so the filter is off (`noCalc`).
- **Topics:** the four areas as tiles, and under them the specification's own headings
  (`aqa_philosophy/spec_philosophy.py`): 28 topics, numbered on from the topic they sit
  under (3.1.2.1 Direct realism, 3.3.2.4 The problem of evil, 3.4.3.1 Philosophical
  behaviourism). "What is knowledge?" stays whole; Meta-ethics' opening (cognitivism and
  non-cognitivism) is a topic of its own, 3.2.3. All are year 0.
- **Pipeline:** `scripts/question-bank/aqa_philosophy/`: `fetch_philosophy.py` (fetch_aqa.py
  over 7171/7172), `spec_philosophy.py`, `cut_philosophy.py` (cut_psychology.py, whose
  layout Philosophy shares, with questions ending at their marks, the scheme frame
  widened to the text's 560pt, the areas' names in a section heading left out, and its
  own report reader for "Question 4:" / "04:" headings; cut.py and cut_psychology.py are
  unchanged), `tag_philosophy.py` (briefed by tag.md's AQA Philosophy section) and
  `build_philosophy.py`. Papers are on R2 under `aqa/AQA-7172*`, crops under `bank/7172*`.
- **Gaps:** AQA no longer publishes June 2019 (the A-Level's first series) and has no AS
  Philosophy (7171) papers on its site or file store, so the bank is A-Level only from
  November 2020. The specimen papers are left out, as for the other AQA banks. AQA
  published no reports for November 2020 or 2021, or for Paper 2 June 2024, so 50
  questions have no examiner's report. There's no past paper library page for
  Philosophy, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_philosophy/fetch_philosophy.py
python3 scripts/question-bank/aqa_philosophy/spec_philosophy.py
python3 scripts/question-bank/aqa_philosophy/cut_philosophy.py
python3 scripts/question-bank/aqa_philosophy/tag_philosophy.py split   # tag the batch, then:
python3 scripts/question-bank/aqa_philosophy/tag_philosophy.py merge
python3 scripts/question-bank/aqa_philosophy/build_philosophy.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-philosophy
```

## AQA GCSE English Literature

Added 27 October 2026, the bank's first essay-on-set-texts subject:
`/question-bank/aqa-gcse-english-literature`, every question from AQA's GCSE English
Literature (8702) papers that AQA still publishes, November 2020 to June 2025. That is 247
questions from 16 papers, every one with its mark scheme cropped and 233 with the
examiner's comments.

- **Topics are the set texts.** A paper asks a question (two, for a modern text) on every
  set text, and a student answers only on the texts they studied, so the bank's topics
  are the texts ("Macbeth", "An Inspector Calls", "Power and conflict", "Unseen poetry")
  under the specification's sections (Shakespeare, the 19th-century novel, modern prose or
  drama, the poetry anthology, unseen poetry). Each question is tagged from its heading in
  the mark scheme or the paper (`aqa_english_lit/texts.py`), so there is no tagging pass.
  Only texts AQA has set a question on since 2020 are listed (the 2025 texts Princess &
  The Hustler, Leave Taking, My Name Is Leon and the Worlds and lives cluster included).
- **Whole questions, extract included.** Answers go in a separate answer book, so a
  question runs from its label to the next "or", heading or label: the extract printed
  under a Shakespeare or novel question's label, the question printed again under it, the
  named poem printed after an anthology question. An unseen question's poem comes before
  its label, so 27.1 runs from the section's start and 27.2 from the end of 27.1; the two
  show as one question. No stems. Ids are `87021-jun24-01`, `87022-jun24-27-1`.
- **Either/or.** In each section every question after the first carries `or`, so a
  paper's marks count the one question a student answers (both unseen questions count).
  A question's marks include its AO4 marks (30 + 4), so every paper adds up to its front
  cover's maximum: 64 for Paper 1, 96 for Paper 2.
- **2021–22.** In November 2021 and June 2022 Paper 1 was sat as three 30-mark papers, one
  a section (1M modern prose or drama, 1N the novel, 1P the anthology: components
  `87021M`, `87021N`, `87021P`), and Paper 2 (70 marks) was Shakespeare and unseen poetry.
  They are separate papers in the filter; the June 2024 Paper 2 is AQA's "8702/2R".
- **Mark schemes:** each question's own page (the question and its indicative content),
  then the section's levels grid (landscape, printed once per section) and, for an AO4
  question, the AO4 descriptors, stacked into one crop. The 8-mark unseen comparison has
  its own grid on its page and takes no other.
- **Reports** go section by section, a paragraph or two a text: a question gets its
  section's paragraphs that name its text, else the section's general paragraphs; the
  2021–22 1P report heads each question, and is used as is. The November 2021 1M report
  names only some texts, so 14 of its questions have no report.
- **Search** covers the whole extract, so searching a quotation finds its question.
- **Pipeline:** `scripts/question-bank/aqa_english_lit/`: `fetch_english_lit.py` (fetch_aqa.py
  over 8702), `texts.py`, `cut_english_lit.py` (its own layout around cut.py's label finder
  and image helpers; cut.py is unchanged) and `build_english_lit.py`. Papers are on R2
  under `aqa/AQA-8702*`, crops under `bank/8702*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (its file store has none), so the bank
  starts at November 2020; the specimen papers are left out. AQA's own copies withhold some
  poems for copyright, and those crops show AQA's note in place of the poem: the unseen
  poems of June 2023 (both), June 2025 (the first, 'Table') and November 2020 (the second), and June
  2022 1P's 'Bayonet Charge'. The questions are all there.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py gcse
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-gcse
```

### AQA A-Level English Literature A

`/question-bank/aqa-a-level-english-literature-a`: every question from AQA's A-Level (7712:
Paper 1 Love through the ages, Paper 2A WW1 and its aftermath, Paper 2B Modern times) and AS
(7711, Papers 1 and 2) English Literature A papers AQA still publishes, November 2020 to June
2025: 303 questions from 28 papers, every one with its mark scheme cropped and 199 with the
examiner's comments. The same scripts with `--level=a`; topics are the set texts again, under
Love through the ages, WW1 and its aftermath and Modern times, with unseen poetry, unseen prose,
comparing texts and each Paper 2's contextual linking as topics of their own.

- **Options.** Paper 2A and 2B offer three options (a poetry, drama or prose set text), each
  a Section A on the set text and a Section B of two questions on an unseen prose extract
  printed in the insert. A student answers one option, so options 2 and 3 carry `or` whole,
  and every paper adds up to 75 (AS: 50). The three options print the same Section B, so its
  two questions appear three times (05/06, 11/12, 17/18), each tagged to that paper's
  contextual linking topic. Section B's ids are `77122a-jun24-b-05`, and their stem is the
  section's introduction and the insert's extract (`77122a-jun24-b-stem.webp`).
- **Questions** print the question before the extract (Shakespeare) or the poems (unseen
  poetry, the AS anthology), and the crop carries both.
- **Mark schemes:** each question's indicative content, starting at its "Question" line,
  then the one levels grid printed for every question. Section B's scheme serves all three
  options ("Questions 05, 11 and 17").
- **Reports** head each question ("Question 1 Othello", "Questions 5, 11, 17"), and each
  question gets its own; questions a report covers only under its text's heading get that.
- **Gaps:** AQA no longer publishes 2017–2019 (or AS 2016–2019). There are no reports for
  November 2020 and 2021, or for AS Paper 2 June 2024, and the June 2025 Paper 2B report
  skips 6 questions. AQA's copies withhold some extracts for copyright, and the crops show
  AQA's note: the Paper 2 insert for November 2021 (2A and 2B), June 2022 (2B: Peyton
  Place, with page references) and June 2025 (2B), and one unseen poem each in Paper 1 June
  2023 and November 2021. Specification B (7717) is not here yet.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py a-level
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=a
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py --level=a
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-a
```

## AQA A-Level Sociology

Added 27 October 2026: `/question-bank/aqa-a-level-sociology`, every question from AQA's
A-Level (7192, Papers 1–3) and AS (7191, Papers 1–2) Sociology papers that AQA still
publishes, November 2020 to June 2025. That is 356 questions from 28 papers, every one
with its mark scheme cropped and tagged to a topic, 286 with the examiner's comments.

- **Whole questions, each Item its stem.** AQA numbers whole questions (`05`), so each is
  one crop, from its label to its marks (the answer lines are left out). The longer
  questions are set on an Item, a boxed passage printed between "Read Item C below…" and
  the question's own words: the box is cut out as the question's stem, and the question's
  crop is its label line stacked on its own words. Each Item serves one question, so the
  id names the Item (`71922-jun24-ic-05`, stem `71922-jun24-ic-stem.webp`); a question
  without one names its option or `q` (`71922-jun24-a2-04`, `71921-jun24-q-01`).
- **Options.** A-Level Paper 2 is Topics A1–A4 (Culture and Identity, Families and
  Households, Health, Work, Poverty and Welfare), one answered, then Topics B1–B4 (Beliefs
  in Society, Global Development, The Media, Stratification and Differentiation), one
  answered. AS Paper 2 is research methods (Section A) and one of four topics (B1–B4, the
  A-Level's A1–A4). Topics A2–A4 and B2–B4 carry `or`, so each paper's marks count one
  topic per section: every paper adds up to its 80 (A-Level) or 60 (AS) marks. Papers 1
  and 3 have no options. `QuestionRow` used to hide the marks of a question that is itself
  an alternative (no part in its row to be the alternative to); it now hides them only
  when the row holds both, which also puts the marks back on AQA Economics' Context 2.
- **Mark schemes:** one table per question ("Qu | Marking guidance | Total marks"), cut
  from its heading to the next question's, so the Item, the whole levels-of-response grid,
  the indicative content and the sources come with it. The cutter checks every 10-mark
  or longer scheme has its levels.
- **Topics:** the specification's areas as tiles (`4.1.1 Education` … `4.3.1 Crime and
  Deviance`; Theory and Methods, which Papers 1 and 3 share, is one area with Methods in
  Context in it), and each area's bullet points as its topics. The specification doesn't
  number its bullets, so the codes number them in order (`4.2.2.4`) and are not shown:
  a topic shows its short name ("Childhood and the status of children",
  `aqa_sociology/spec_sociology.py`). An option question is always tagged to its option.
- **Pipeline:** `scripts/question-bank/aqa_sociology/`: `fetch_sociology.py` (fetch_aqa.py
  over 7191/7192), `spec_sociology.py`, `cut_sociology.py` (its own layout around cut.py's
  label finder and image helpers; cut.py is unchanged), `tag_sociology.py` (briefed by
  tag.md's AQA Sociology section; merge rejects a first tag outside the question's area)
  and `build_sociology.py`. Papers are on R2 under `aqa/`, crops under `bank/7191*`, `bank/7192*`.
- **Gaps:** AQA no longer publishes June 2017–2019, and sat no AS papers in November 2021,
  so the bank starts at November 2020. The specimen papers are left out, as for the other
  AQA banks. AQA published no reports for AS November 2020 or Paper 1 June 2025, and its
  November 2020 and 2021 Paper 2 reports cover only Families and Households and Beliefs in
  Society (6 of 24 questions). There's no past paper library page for AQA Sociology yet,
  so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/aqa_sociology/fetch_sociology.py
python3 scripts/question-bank/aqa_sociology/spec_sociology.py
python3 scripts/question-bank/aqa_sociology/cut_sociology.py
python3 scripts/question-bank/aqa_sociology/tag_sociology.py split   # tag the batches, then:
python3 scripts/question-bank/aqa_sociology/tag_sociology.py merge
python3 scripts/question-bank/aqa_sociology/build_sociology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-sociology
```

## Cambridge International (CAIE)

Added 25 October 2026, after a student asked for CAIE:

| Bank | Syllabus | Unit | Questions |
| --- | --- | --- | --- |
| `/question-bank/caie-a-level-maths` | 9709, Papers 1-6 | whole question | 100 |
| `/question-bank/caie-a-level-further-maths` | 9231, Papers 1-4 | whole question | 56 |
| `/question-bank/caie-a-level-biology` | 9700, Papers 1, 2, 4, 5 | part | 240 |
| `/question-bank/caie-a-level-chemistry` | 9701, Papers 1, 2, 4, 5 | part | 312 |
| `/question-bank/caie-a-level-physics` | 9702, Papers 1, 2, 4, 5 | part | 266 |

Students search "CAIE" and "Cambridge International" (and "AS & A Level"), so the
board is "CAIE" in titles, the hub shelf is "Cambridge International (CAIE)", and
each bank's lead names the syllabus ("Chemistry (9701)").

**What's public, and so what's here.** Cambridge keeps its past paper archive on the
School Support Hub, for registered schools; we never fetch from it or from mirrors.
Its public site has, per syllabus, one series (May/June 2024, one time-zone variant
of each component: 9709/11, not /12 or /13), that series's examiner report, and the
specimen papers (maths for exams from 2020, sciences from 2022). The banks are those,
about half June 2024 and half specimens, and say so: `scope` ("June 2024 and the
specimen papers") replaces the year range in their copy and metadata, and their
leads say the rest is on the School Support Hub. When Cambridge rotates the public
series (to May/June 2025, say), re-run the library's `boards/cie.py`, then the steps
below: the old series stays only if we kept its files.

- **Papers:** the past paper library's CIE fetcher (`scripts/past-papers/boards/cie.py`,
  PR #15) downloads everything public, with `gaps.md` listing what isn't.
  `caie/fetch_caie.py` (and `--maths`) copies the question papers and schemes the bank
  needs; the "whole paper" links are the library's R2 keys (`cie/CIE-9709-11-QP-JUN24.pdf`),
  already in the bucket. One report covers the whole syllabus, a section per component,
  so each component's set points at it with `section: "9709/11"`.
- **Papers left out:** the science practicals (Paper 3): their questions are
  instructions for apparatus on the bench. Paper 5 (planning, analysis and evaluation)
  is in.
- **A paper** is its syllabus and number, the same for the June sitting (9709/31) and
  the specimen (9709/03): `97093`, so the paper filter lists each paper once.
- **Topics:** from Cambridge's current syllabuses (`caie/spec_caie.py`; sciences
  2025-2027, maths 2026-2027, which match the 2024 papers and specimens): topics ("23
  Chemical energetics") as tiles and sub-topics ("23.1 Lattice energy and Born-Haber
  cycles") under them. Sciences: topics 1-11 (Chemistry 1-22) are Year 1 · AS. Maths
  is set out by paper, so a paper's content is a tile ("Pure Mathematics 3") and a
  question only takes its own paper's codes (merge enforces it).
- **Cutting:** `edexcel_sciences/cut_pearson.py` reads Cambridge's layout too, all of
  it behind `Doc.cambridge` (a "© UCLES" or "Cambridge International" on the first
  pages), so Pearson and OCR cut exactly as before (checked: OCR's 8,182 parts and
  their images came out byte for byte the same). It turns the specimen schemes'
  landscape tables, set sideways on portrait pages without a rotation flag; keeps
  scheme crops inside the table, under the running header and above the footer; skips
  the numbered marking instructions before the first "Question" header and the
  numbered answer points beside the narrow Question column; reads a question number
  and its "(a)" a fraction of a point apart as one line; ignores "(n)" in tables when
  counting marks; ends a paper's last question at its data sheet, periodic table or
  copyright notice (Cambridge prints no "END OF QUESTION PAPER"); and gives a
  multiple-choice question its 1 mark.
- **Tagging:** `caie/tag_caie.py split|merge` for both work folders, briefed by
  tag.md's CAIE section.
- **Building:** `caie/build_caie.py` for both work folders.

Gaps: Cambridge's public link for the 9231 Paper 2 specimen mark scheme serves the
question paper itself, so those 8 questions have no scheme (fetch_caie.py leaves the
file out). One scheme misprint, 9701/51 "1(b)(ii)" for 1(c)(ii), is read as the part
it follows. IGCSE is below.

```bash
python3 scripts/question-bank/caie/fetch_caie.py [--maths]
python3 scripts/question-bank/caie/spec_caie.py [--maths]
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-sciences
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-maths --whole
python3 scripts/question-bank/caie/tag_caie.py split [scripts/question-bank/.work/caie-maths]   # tag, then: merge
python3 scripts/question-bank/caie/build_caie.py [scripts/question-bank/.work/caie-maths]
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-sciences --crops-only   # the PDFs are the library's
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-maths --crops-only
```

## WJEC (Wales)

Added 26 October 2026, after students asked for WJEC:

| Bank | Units | Unit of the bank | Questions |
| --- | --- | --- | --- |
| `/question-bank/wjec-a-level-biology` | 2400U10, 2400U20 (AS), 1400U30, 1400U40 | part | 1,223 |
| `/question-bank/wjec-a-level-chemistry` | 2410U10, 2410U20 (AS), 1410U30, 1410U40 | part | 1,204 |
| `/question-bank/wjec-a-level-physics` | 2420U10, 2420U20 (AS), 1420U30, 1420U40 | part | 1,173 |
| `/question-bank/wjec-a-level-maths` | 2300U10, 2300U20 (AS), 1300U30, 1300U40 | whole question | 314 |

Series: every summer WJEC publishes, Summer 2016 (the sciences' AS units; their A2
units start in 2017) to Summer 2025, without 2020 and 2021 (no exams); Maths from
Summer 2018. Every paper there is has its scheme; examiners' reports from 2017
(Biology from 2016). WJEC calls its series "Summer 2023", so the banks do; the ids
stay `JUN23`. Students in Wales say "WJEC A Level", so the shelf is "WJEC AS & A Level
(Wales)" and papers are units: "AS Unit 1", "Unit 3".

- **Source: WJEC's own site only.** Each qualification page loads its "Past Papers /
  Mark Schemes" tab from `/umbraco/surface/TabSurface/GetpastpapersTab`, a JSON list
  linking to `pastpapers.download.wjec.co.uk`, and its key documents (the specification
  and the examiners' reports) from `GetkeydocumentsTab`; `wjec/fetch_wjec.py` reads
  both. Never Physics & Maths Tutor, which the past paper library's WJEC links point at.
  English-medium papers only. Left out: the practical exam (Unit 5), modified
  large-print papers (one, 2018 Maths Unit 1, is listed as the "Past Paper" itself, so
  `-mlp` files are dropped by name), inserts and data booklets. The list's labels
  aren't trusted: 2019 lists every scheme twice, 2016's Physics "Past Paper" rows are
  its schemes, and two Chemistry scheme covers misprint their unit code, so each file is
  read for what it is. Whole papers are `wjec/WJEC-2420U10-1-QP-JUN23.pdf` in R2 (the
  bucket already held the papers and schemes under these names, byte for byte; the
  reports, `wjec/WJEC-physics-ER-JUN23.pdf`, one per subject a summer, are new).
- **Cutting:** `wjec/cut_wjec.py` uses `edexcel_sciences/cut_pearson.py` as a library,
  unchanged (so no other board's crops move), and sets WJEC's differences in its place
  for its own run: question numbers with a full stop ("1."), papers ending at "END OF
  PAPER", Unit 4's options headed "Option A – Alternating Currents" with no number
  (numbered on from the last question, as the schemes do), the "[6 QER]" marks of the
  extended response question, maths's boxed numbers ("0" "1") and whole questions, the
  schemes' "Summary of marks allocated" grid and "Question 1 total" rows (left off),
  their "1." labels, their three label columns read a point apart, and maths's "Q"/"Qu."
  header and mechanics tables closed by "Total for Question 7". Check: every paper's
  marks per question match its cover's mark grid, except where a question's marks are
  the options' (all four options are in, so Physics Unit 4 sums to 160).
- **Topics:** `wjec/spec_wjec.py` reads the specifications: a tile per unit, its topics
  under it ("1.2 Kinematics"), Unit 4's options as their own topics (`4.A`). Maths uses
  the Edexcel maths topics, as the OCR and CAIE maths banks do.
- **Tagging:** `wjec/tag_wjec.py split|merge`, tag.md's WJEC section; every part of an
  option takes its option's code without a reader.
- **Practicals:** 295 parts (Biology 74, Chemistry 106, Physics 115), judged as below.

Gaps: no 2016 reports for Physics or Chemistry (WJEC publishes none). A few report
sections are written by theme, not question (Chemistry Unit 4 and Biology Unit 2 in
2025), and the maths reports comment only on some questions, so those have none;
3,440 of 3,914 have one. 20 science parts have no scheme crop
and link the whole scheme. Not built yet: Further Maths (on the same WJEC page) and
the GCSEs (legacy Wales sciences and maths, being replaced by the Made-for-Wales GCSEs).

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py            # --only=physics for one subject
python3 scripts/question-bank/wjec/spec_wjec.py
python3 scripts/question-bank/wjec/cut_wjec.py               # the sciences; --only=2420u10-jun23 for one paper
python3 scripts/question-bank/wjec/cut_wjec.py --whole       # maths
python3 scripts/question-bank/wjec/tag_wjec.py split         # tag, then: merge
python3 scripts/question-bank/wjec/build_wjec.py
python3 scripts/question-bank/practicals.py split --parts=scripts/question-bank/.work/wjec/parts.json --only=wjec-a-level-biology,wjec-a-level-chemistry,wjec-a-level-physics   # judge, then merge --only=…
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec --pdf-prefix=wjec/
```

## WJEC A-Level Business

Added 28 October 2026, after a student asked for it (and pointed out that WJEC's Business is
"the exact same content as Eduqas just organised in different overall chapters", which is
right: the two specifications list the same 22 content areas with word-for-word the same
learning outcomes, WJEC adding "in Wales and the rest of the UK"; WJEC sets them out as four
units, AS Units 1 and 2 and A2 Units 3 and 4, where Eduqas's Component 1 is WJEC's Units 1 and
2 together). `/question-bank/wjec-a-level-business`: 410 parts from WJEC's 30 published papers,
June 2016 (AS) and June 2017 (A2) to June 2025 (none sat in 2020 or 2021), every one tagged, 408
with their own mark scheme rows (the other two, Unit 3 June 2017 Questions 3 and 7, link the
whole scheme), 388 with their case as a stem and 362 with the examiner's comments.

- **Papers:** Units 1 and 3 are "1. Time for Tea", its case, then "(a)", "(b)", which
  `cut_wjec.py` reads. Units 2 and 4 are answered in a separate booklet and box each part's
  number, "2" then "1", with the case headed by its title alone; 2022's Unit 4 boxes the
  question's number ("0 1") and prints its parts "a)". `wjec/cut_wjec_business.py` reads both
  (a boxed part is cut as part "a" and shown "2.1"), and starts a question at its case's title
  so the case is the part's stem.
- **Schemes:** a block per part, not a table, opened by a label printed differently most
  summers ("Q3(a)", "Q 1 1", "1:1", "1. 1.", "1 (a)", "1 1" as two lines, "(b)" with its
  question carried, "4" alone for a question with no parts), with the levels grid's band
  numbers down the same column. A bare number counts only as the next question's and only where
  no other bare number shares its column. Every paper adds up the same each year: Unit 1 60,
  Unit 2 80, Unit 3 80, Unit 4 140 (its 50-mark Section A and all three 30-mark Section B
  choices; a student answers one).
- **Reports:** one a summer for the subject, a section a unit (`cut_wjec.py`). 2024's Unit 2
  heads its comments by part run together, "Q.11", "Q.12": those go with question 1. AS Unit 2
  June 2018's report comments on two questions only.
- **Topics:** `wjec/spec_wjec_business.py` reads the specification's "Content | Amplification"
  tables: Unit 1's eight areas (`1.3 Markets`), Unit 2's four areas as sections of their own
  with their sub-headings as topics (`2.3.8 Motivation`), Unit 3's ten and Unit 4's twelve
  (its PEST and ethical, legal and environmental rows are a factor each, `4.4 Economic
  factors`): 61 topics, AS ones year 1. Tagged by three readers (tag.md's WJEC section); an AS
  paper's part takes its own unit's topics, the A2 papers any.
- **Pipeline** (its own work dir, `.work/wjec-business`):

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py scripts/question-bank/.work/wjec-business --only=business
python3 scripts/question-bank/wjec/cut_wjec_business.py scripts/question-bank/.work/wjec-business
python3 scripts/question-bank/wjec/spec_wjec_business.py scripts/question-bank/.work/wjec-business
python3 scripts/question-bank/wjec/tag_wjec.py split scripts/question-bank/.work/wjec-business 140   # then tag, merge
python3 scripts/question-bank/wjec/build_wjec.py scripts/question-bank/.work/wjec-business            # writes only the banks it has parts for
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec-business --pdf-prefix=wjec/
```

`fetch_wjec.py` now also accepts "Answer all the questions" on a cover (Unit 1, 2016–19 and
2024, which it had read as inserts). Eduqas's A Level Business would be the same pipeline over
Eduqas's site, with Component 1 tagged against Units 1 and 2's topics.

## Year 12 and Year 13 (A-Level Maths and Further Maths)

A student asked for it (27 October 2026): "the maths questions are kinda annoying bc it
includes yr13 stuff as a year 12". The sciences split by topic (each topic's `year`), but
maths topics (Algebra, Differentiation, Integration…) run through both years, so maths
splits by question: the A-Level Maths banks' "Year" filter shows Year 12 (questions that
need only the AS content) or Year 13 (questions that need second-year content).

- **Data:** `public/question-bank/<slug>/year13.json`, the ids of the Year 13 questions,
  beside the bank's data so a rebuild leaves it alone. `bankHasYears` turns the filter
  on for A-Level Maths and Further Maths; the URL keeps it as `?yr=12` or `?yr=13`.
- **Where it shows:** a "School year" switch (Both years · Year 12 · Year 13, with
  counts) at the top of the filters, above the topics, and on a single topic's page too.
  It started as two checkboxes near the bottom, and a student on Edexcel Maths didn't
  find them ("its not separated", 27 October 2026).
- **Which is which:** an AS paper's questions are all Year 12. WJEC's Units 3 and 4 and
  Cambridge's Papers 3 and 6 test only second-year content, so theirs are all Year 13.
  Each question on a full A-Level paper (Edexcel, OCR, OCR MEI, AQA) was read against the
  brief in `tag.md` ("Year 12 or Year 13"): Year 12 only when every part can be done
  with AS content.
- **After a new series:** `maths_years.py split`, read the new batches, `maths_years.py merge`.
- **Further Maths** (Edexcel, OCR, OCR MEI) splits the same way: AS Further Maths papers
  are Year 12, and each A-Level paper question was read against that board's AS Further
  Maths specification (`maths_years.py split-further` / `merge-further`, brief in
  `tag.md`). Cambridge's Further Maths (9231) has no AS, so it has no switch.

**Exam years, several at once (27 October 2026).** A student wanted to "keep 24 and 25
untouched but do all the ones below it" (for a mock). The Exam control is a checklist
now, not a single choice: every sitting starts ticked, untick the ones to keep back (or
"Leave out the latest two"), and the list, the counts and "Download PDF" follow. The URL
keeps it as `?year=JUN23,JUN22,…`, which the page already read.

## Practicals and whole questions

Added 25 October 2026, from a student's feedback ("a filter for questions based on
practicals, and whole questions rather than the relevant parts only"):

- **Practicals filter** (`?practical=only` or `none`), on every Biology, Chemistry and
  Physics bank: the parts about doing an experiment, such as methods, apparatus and
  techniques, variables, measurements and uncertainty, safety, improving an
  experiment, and the required, core and PAG practicals. That is 2,947 of 24,894 science
  parts. `scripts/question-bank/practicals.py split` casts a wide net over each bank's
  text (4,651 candidates), Claude subagents read and judged every candidate against
  tag.md's "Practical questions" brief, and `merge` writes each bank's
  `public/question-bank/<slug>/practicals.json`. That file sits beside the bank's data
  rather than in it, so rebuilding a bank never drops it; a bank without one (maths,
  Psychology, a newly added science bank) simply shows no filter. To add a new bank or
  series, run `practicals.py split --parts=<its cut parts.json> --only=<slug>`, judge
  the batches, then `merge`.
- **Whole questions** (`?view=whole`): one card per question with its start and
  every part in order, its total marks, every part's mark scheme, and the examiner's
  report for the whole question. A question is listed when any of its parts matches
  the filters, and "+ Add to set" and download by number take the whole question.
  Banks cut a whole question at a time already (maths) don't show the switch.

Judging was done in parallel and the readers differed on one borderline case: a
calculation from a titration or calorimetry experiment's results. Some readers counted
it as practical, others didn't.

### Cambridge IGCSE

Added 25 October 2026, after the A Level banks:

| Bank | Syllabus | Unit | Questions |
| --- | --- | --- | --- |
| `/question-bank/caie-igcse-maths` | 0580 (and 9-1 0980), Papers 1-4 | whole question | 228 |
| `/question-bank/caie-igcse-additional-maths` | 0606, Papers 1-2 | whole question | 46 |
| `/question-bank/caie-igcse-biology` | 0610 (and 9-1 0970), Papers 1-4, 6 | part | 346 |
| `/question-bank/caie-igcse-chemistry` | 0620 (and 9-1 0971), Papers 1-4, 6 | part | 407 |
| `/question-bank/caie-igcse-physics` | 0625 (and 9-1 0972), Papers 1-4, 6 | part | 355 |

The same public papers (June 2024 and the specimens) and the same scripts, with
`--igcse`. The banks' level is "IGCSE" (`BankSubject.level`), so titles read "CAIE IGCSE
Biology", and their "every paper" links go to the library's `/past-papers/gcse-*/cie-igcse`
pages, where Cambridge IGCSE (Additional Maths too) shelves with GCSE.

- **The 9-1 syllabuses.** 0970, 0971 and 0972 sit 0610, 0620 and 0625's papers word for
  word (June 2024 and specimens compared: the same text), so they are left out and the
  banks name them (`fullName` "Biology (0610 and 9–1 0970)", `specs`). Mathematics 9-1
  0980 shares 0580's specimens, but its public June 2024 papers are another time-zone
  variant (0980/12, /22, /32, /42 against 0580/11, /21, /31, /41), different questions on
  the same content: they are in the 0580 bank as 0580's papers in a second sitting,
  series `JUN24V2`, "June 2024 (0980)". The bank's sort reads that as June 2024 and keeps
  the two variants apart.
- **Papers left out:** the science practical tests (Paper 5). Paper 6, the alternative to
  practical, is in. Core (1, 3) and Extended (2, 4) papers say which in their titles.
  Maths papers are just "Core" or "Extended": the 2025 specimens' Papers 1 and 2 are
  non-calculator, June 2024's (the previous syllabus) were not.
- **Topics** (`spec_caie.py --igcse`), from the syllabuses the papers were set on
  (sciences 2023-2025, maths 2025-2027), tiles' titles read from each content overview:
  sciences as A Level (topic tiles, "8.3 Transpiration" under them); 0580 by its
  sub-topic numbers, which Core (C1.1) and Extended (E1.1) share, as `1.1`, with
  `extended` on the 19 Core leaves out (merge keeps them off Core papers); 0606 numbers
  single learning statements, not titled sub-topics, so each of its 14 topics is one
  tile and one code.
- **Cutting** (still all behind `Doc.cambridge`): the 2025 specimens print neither "©
  UCLES" nor "Cambridge International", only "Cambridge IGCSE™", which now marks a
  Cambridge paper too ("Cambridge University Press & Assessment" would catch OCR's);
  Cambridge's white text is ignored (the maths specimens hide a second "[2]" under some
  answer lines, which had doubled their marks); and a bold question number may run
  straight into algebra in its span ("10 a = 5/7"). Every set's marks add up to the
  paper's total. Scheme rows now start at the table rule above their label rather than
  6pt above it: Cambridge's one-line rows sit closer than that, so a third of the crops
  (A Level's too) had lost the foot of their last line, and a whole question's rows
  showed a sliver of the one above. The A Level banks were re-cut and their scheme crops
  re-uploaded (questions, marks and tags unchanged; search text lost some hidden white
  text). `upload_r2.py --checksum` compares R2's checksums rather than sizes, since a
  re-cut crop can keep its size.
- **Gaps:** 0625/21 Question 14 is left out ("Question Discounted" in Cambridge's scheme).
  Cambridge's 0980 report has no Paper 42 section, so those questions have no report.
  The multiple-choice reports discuss only some questions.

```bash
python3 scripts/question-bank/caie/fetch_caie.py --igcse [--maths]
python3 scripts/question-bank/caie/spec_caie.py --igcse [--maths]
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-igcse-sciences
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-igcse-maths --whole
python3 scripts/question-bank/caie/tag_caie.py split scripts/question-bank/.work/caie-igcse-sciences 120   # tag, then: merge
python3 scripts/question-bank/caie/build_caie.py scripts/question-bank/.work/caie-igcse-sciences   # and caie-igcse-maths
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-igcse-sciences --crops-only
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-igcse-maths --crops-only   # after a re-cut: --checksum
```

## Eduqas A-Level sciences

Added 26 October 2026, after students asked for Eduqas Physics:

| Bank | Specification | Components | Series | Questions |
| --- | --- | --- | --- | --- |
| `/question-bank/eduqas-a-level-physics` | A420 (AS B420) | 1-3 (AS 1-2) | June 2016–2025, Autumn 2020–21 | 1,592 |
| `/question-bank/eduqas-a-level-chemistry` | A410 (AS B410) | 1-3 (AS 1-2) | June 2016–19 and 2024–25, Autumn 2020–21 | 1,513 |
| `/question-bank/eduqas-a-level-biology` | A400 (AS B400) | 1-3 (AS 1-2) | June 2016–2025, Autumn 2020–21 | 2,061 |

June 2016 is AS only: the A-Level was first sat in 2017. Eduqas is WJEC's brand for England; the papers are © WJEC CBAC Ltd., credited as "WJEC
Eduqas". The board is "Eduqas" in titles, with its own hub shelf ("Eduqas A-Level").
Papers are called components, as Eduqas does ("Component 1: Newtonian Physics", "AS
Component 2"), and the October–November 2020 and 2021 sittings are "Autumn" (`OCT20`).

- **Papers:** only eduqas.co.uk. `eduqas/fetch_eduqas.py` reads each qualification
  page's tabs from `/umbraco/surface/TabSurface/Get<tab>Tab?qualificationId=…` (the
  page loads them by script): "pastpapers" lists question papers, mark schemes, data
  booklets and large-print papers on pastpapers.download.wjec.co.uk, "keydocuments" the
  specifications and examiner's reports (one per level and series, a section per
  component). Large-print papers are left out. Eduqas files AS Physics June 2018's two
  mark schemes under each other's names: the fetcher files a paper or scheme under the
  component its cover names. Whole papers are in R2 under `eduqas/a420u10-qp-jun24.pdf`
  (the library's own Eduqas copies, `eduqas/EDUQAS-…`, are a different set of names).
- **Cutting:** `eduqas/cut_eduqas.py`, self-contained (cut_pearson.py is untouched).
  WJEC typesets Eduqas's and its own papers the same way, so it should cut WJEC banks
  too. Question papers: labels down the left inside the drawn frame, a bold "3." then
  "(a)" and "(i)" each set with a tab; a label only counts as the next one expected,
  so paragraph numbers in a comprehension stay out; a sub-part label set right of a
  figure still counts by its tab; questions set straight in "(i)", "(ii)" are read as
  such. Trailing answer lines (dotted rules) are left off each crop and pages of nothing
  but answer lines dropped; a full-page graph grid isn't mistaken for the frame. Physics
  Component 1's comprehension article is its question's stem, and a part ends above
  Component 3's option headings ("Option B – Medical Physics"). Schemes: the "Question |
  Marking details | … | Prac" table, its header repeated on most pages (2018's continue
  without it); label pieces sit in the columns left of "Marking details", and a row
  only counts when its label is one the paper has, in order, so a levels table's "4"
  or a numbered answer point never starts a row. The crop is the page's header with the
  part's rows under it, stopping at "Question 3 total" and before the summary of marks.
  It copes with "1." and "5 (a)" labels, "iii" without brackets, "(i) (ii)" sharing one
  cell, "6 (ii)" for 6(d)(ii), "5 (a) (i)" where the paper's (a) has no sub-parts, and
  rows a page leaves unruled at its foot. `scripts/question-bank/labels/a400u20-oct20.json`
  maps one misnumbered scheme ((v), (vi) for the paper's (iv), (v)). Every part has its
  scheme crop except two essays whose scheme rows Eduqas left unlabelled
  (Biology A400U20 Autumn 2020 Q7, AS B400U10 June 2025 Q6): they link the whole scheme.
- **Topics:** `eduqas/spec_eduqas.py`, from the A-Level specifications. Physics and
  Biology number topics within components ("1.2 Kinematics", "3.10 Electromagnetic
  induction"), with the Component 3 options as `3.A`-`3.D` (Year · options); Biology's
  Core Concepts, examined in every component, are `C.1`-`C.5`. Chemistry prints its own
  codes (`C1.3`, `PI2.2`, `OA3.1`; `PI3` and `OA4` have no sub-topics). A topic is AS
  (Year 1) when the AS specification has it, matched by title. AS papers are tagged
  only to AS topics (merge enforces it).
- **Tagging:** `eduqas/tag_eduqas.py split|merge`, briefed by tag.md's Eduqas section.
  Moments, equilibrium and centre of gravity are Physics 1.1 (Basic physics) in this
  specification; `tag/overrides.json` puts 16 parts one reader had under Dynamics there.
- **Practicals:** Eduqas's schemes give each part's practical-skills marks in a "Prac"
  column (`prac` in parts.json). `eduqas/practical_candidates.py` adds those the usual
  net misses to practicals.py's batches; every candidate (1,691) was judged by the usual
  brief, since the column is broader than it (Chemistry credits a reagent for a synthesis
  step). 933 are practical: Physics 219, Chemistry 357, Biology 357.
- **Gaps:** Eduqas puts papers up a year after the exam (June 2026 next autumn) and
  doesn't publish some: no A-Level Physics question papers for June 2022 (only
  large-print copies of two components), no Chemistry question papers for June 2022 or
  2023 (A-Level or AS), and no AS Physics or AS Chemistry autumn sittings. Examiner's
  reports: none for Autumn 2021, AS Physics June 2019, 2022 or 2025, or AS Biology Autumn
  2021, and the June 2025 Chemistry and Biology reports are a summary with no comments on
  questions.

```bash
python3 scripts/question-bank/eduqas/fetch_eduqas.py              # --only=physics; prints the gaps
python3 scripts/question-bank/eduqas/spec_eduqas.py
python3 scripts/question-bank/eduqas/cut_eduqas.py                # --only=a420u10-jun24; --debug prints scheme labels
python3 scripts/question-bank/eduqas/tag_eduqas.py split          # tag, then: merge
python3 scripts/question-bank/eduqas/build_eduqas.py
python3 scripts/question-bank/practicals.py split --only=eduqas-a-level-physics,eduqas-a-level-chemistry,eduqas-a-level-biology --parts=scripts/question-bank/.work/eduqas-sciences/parts.json
python3 scripts/question-bank/eduqas/practical_candidates.py      # judge, then: practicals.py merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-sciences --pdf-prefix=eduqas/
```

## Computer Science (OCR and AQA)

Added 26 October 2026, the bank's first Computer Science: `/question-bank/ocr-a-level-computer-science`
(A-Level H446 and AS H046) and `/question-bank/aqa-a-level-computer-science` (A-Level 7517
and AS 7516), on the existing OCR and AQA A-Level shelves. Every paper is the board's own
file from ocr.org.uk or aqa.org.uk (AQA's newest files sit on its CDN, linked from its
pages); the whole papers are on R2 under `ocr/OCR-H446-01-QP-JUN24.pdf` (the library's
naming) and `aqa/AQA-75171-QP-JUN24.pdf`, the crops under `bank/h446*`, `bank/h046*`,
`bank/7516*` and `bank/7517*`.

- **OCR: 593 parts** from 18 papers: A-Level Papers 1 and 2 for November 2021 and June
  2022 to 2025, AS Papers 1 and 2 for June 2022 to 2025. Every paper's parts add up to its
  140 (AS 70) marks, every part has its own mark scheme rows, and 500 (all but a few of the
  June parts) have the examiner's comments on their question. Topics: the A-Level's 24 numbered topics (1.1.1
  Structure and function of the processor … 2.3.1 Algorithms) in 8 sections; AS papers
  are tagged with the same codes. All but 1.3.1 and 2.1.5 are AS content.
- **AQA: 561 parts** from 22 papers: A-Level and AS Papers 1 and 2 for November 2020 and
  June 2022 to 2025, and A-Level Papers 1 and 2 for November 2021 (AQA sat no AS then).
  Every Paper 2 adds up to its 100 (AS 75) marks, every part has its own mark scheme rows,
  and 435 have the examiner's comments on their question. Topics: the A-Level's 51 three-number topics (4.2.6
  Hash tables, 4.10.4 SQL) in 13 sections, the project (4.14) left out; 24 are AS content.
- **AQA Paper 1 is sat on screen**, around a Skeleton Program and Preliminary Material
  AQA sends schools beforehand. Its first section (theory) and its programming task
  ("write a program…", starting from an empty project) stand on their own and are here,
  their marks adding up to what the paper prints before the Skeleton Program section
  (A-Level 38–50 of 100, AS 18–25 of 75). The section headed "These questions refer to the
  Preliminary Material and the Skeleton Program", and the one after it (changing the
  program), are left out: they can't be answered without the program. The paper filter
  says so ("On-screen: theory and programming task"), and so does the bank page.
- **Code is cropped whole:** listings, trace tables, SQL and LMC programs come with the
  part that asks about them. OCR prints a part's code once, above its first sub-part:
  every sub-part carries it here (1(c)(ii) shows the quick sort that 1(c)(i) did).
- **Pipeline:** `scripts/question-bank/computer_science/`: `fetch_ocr_cs.py` (OCR's
  assessment page), `fetch_aqa_cs.py` (fetch_aqa.py over 7516/7517, plus the preliminary
  material, fetched only to read), `spec_cs.py`, `cut_ocr_cs.py` (cut_pearson.py as a
  library, unchanged), `cut_aqa_cs.py` (cut.py, patched for this run only),
  `tag_cs.py` (briefed by tag.md's Computer Science section) and `build_cs.py`.
  Seven scheme rows the schemes number differently from the papers (OCR prints "4(a)(i)"
  for a paper's 4(a)) are put right in `scripts/question-bank/labels/<set>.json`.
- **OCR's older series, from Physics & Maths Tutor (27 October 2026).** OCR publishes
  A-Level from November 2021 and AS from June 2022 only; the earlier series are on Teach
  Cambridge, its teacher login. The founder asked for them from PMT, for the question bank
  only (not the past paper library): A-Level June 2017-2019 and November 2020, AS June
  2016-2019 and November 2020, 18 papers and 565 parts (`fetch_pmt_ocr_cs.py`, run after
  `fetch_ocr_cs.py`; PMT's copies are OCR's own PDFs, with a "PMT" stamp in the top corner
  outside every crop). Every paper adds up (140 and 70). Four needed label files: AS Paper 2
  2016 (Q7's four one-line parts share one "[4]"; each gets 1 mark and the scheme's Q7
  block) and 2017 (a numbered answer list read as Questions 1-3), A-Level Paper 1 November
  2020 (Q4's "(a) (i)" on one line; Q6 and Q8 the scheme files as "(a)") and Paper 2 June
  2017 (parts printed "(c*)"). Ten parts link to the whole scheme (Paper 1 June 2019 Q10,
  AS Paper 2 November 2020 Q2(b)-(d) and June 2019 Q4(b)), whose rows the cutter can't
  find. PMT has examiners' reports for only two of these papers, so they have none here.
  `tag_cs.py split` now batches only the parts not yet tagged.
- **Gaps:** there are no OCR series before June 2016 (AS) or June 2017 (A-Level). OCR's November 2021 reports comment on the paper as a whole, not
  question by question (OCR says so), and its H446/01 November 2021 question 7(c)(ii)
  had an error (a corrected paper went to centres only), so that part is left out. AQA
  publishes November 2020 on; its file store has nothing earlier for 7516/7517. AQA has no
  reports for November 2020 (except A-Level Paper 2) or November 2021, nor for AS Paper 1
  June 2025. AQA's A-Level Paper 1 June 2025 report is headed "7516/2" on its pages; its
  content is 7517/1's.

```bash
python3 scripts/question-bank/computer_science/fetch_ocr_cs.py
python3 scripts/question-bank/computer_science/fetch_aqa_cs.py
python3 scripts/question-bank/computer_science/spec_cs.py
python3 scripts/question-bank/computer_science/cut_ocr_cs.py      # --only=h44602-jun25
python3 scripts/question-bank/computer_science/cut_aqa_cs.py      # --only=75172
python3 scripts/question-bank/computer_science/tag_cs.py split    # tag, then: merge
python3 scripts/question-bank/computer_science/build_cs.py        # also stages the whole papers in <work>/r2/pdf
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-cs/r2 --pdf-prefix=ocr/   # r2/img -> ../img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-cs/r2 --pdf-prefix=aqa/
```
