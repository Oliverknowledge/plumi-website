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

## Students' feedback of 29 October 2026

- **Several papers at once.** The Paper control is a checklist, as Exam is (`?paper=8464B1H,8464B1F`),
  with "Higher only" and "Foundation only" on a tiered GCSE bank.
- **Questions on both tiers.** A GCSE sitting's Foundation and Higher papers share questions (AQA's
  Foundation paper ends with the Higher paper's first two or three; Pearson shares a few). `tiers.py`
  matches each Foundation part to the same sitting's Higher part by its words and marks, one to one, and
  writes `public/question-bank/<slug>/tiers.json` ({Foundation id: Higher id}) beside the bank's data:
  214 to 396 parts a bank, every pair checked to map whole questions (Foundation 7-8 to Higher 1-2).
  "On both tiers: Show once" (`?tiers=once`) leaves a Foundation part out when its Higher twin's paper is
  in view too. Re-run `python3 scripts/question-bank/tiers.py` after a new series.
- **The question so far.** A later part can rest on what an earlier one gave (WJEC Physics 2025 Q5(b)
  needs the stone's mass from (a)), so a part with earlier parts offers "Show question 5 so far": the
  question's start and every part before it.
- **Set PDFs.** A crop up to 1.4 pages tall is shrunk onto one page; a longer one is cut at a blank row up
  to half a page back (it was a fifth), so a graph, which has no blank row, moves whole to the next page.
- **Past papers.** A tickbox before each sitting marks it done (`DoneTick`, kept in the browser, no
  account). Edexcel GCSE Maths' 2017 and 2018 papers (both tiers), which Pearson publishes only as zips and the
  library's fetch passed over, join its table from the bank's own copies (`withBankGcseMaths`).

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

## GCSE Maths, Foundation and Higher tiers (AQA, Edexcel and OCR)

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

## Edexcel A-Level Economics B

Added 31 October 2026: `/question-bank/edexcel-a-level-economics-b`, every question from
Pearson's A-Level (9EB0) Economics B Papers 1 to 3 that Pearson publishes, June 2017 to
June 2025 (June 2026 is for teachers only), nine sittings including October 2020 and
November 2021. That is 252 parts from 27 papers, every one with its mark scheme crop;
216 with the examiner's comments. The AS (8EB0) papers are a separate qualification and
aren't in the bank.

- **Papers:** Paper 1 "Markets and how they work" (Themes 1 and 4) and Paper 2 "Competing in
  the global economy" (Themes 2 and 3) are each a Section A data response (Q1, parts (a) to
  (h), 4 to 12 marks) and two 20-mark essays on extracts (Q2 and Q3, one part each).
  Paper 3 "The economic environment and business" is two sections of four parts (4 to 20
  marks) on extracts, after a context announced the year before. Every paper is 100 marks.
  Nothing is an alternative: all questions are compulsory.
- **Topics:** the specification's 23 numbered topics as tiles ("1.3 Introducing the market")
  and 85 sub-topics under them ("1.3.1 Demand"), shown by area, not by year: Economics B has
  no AS split (`edexcel_economics_b/spec_economics_b.py`).
- **Extracts:** as Economics A, `cut_pearson.py --extracts` attaches the extracts printed
  before a question to its stem. Economics B's one-part essays (Q2, Q3) are set on extracts
  too, so `--stem-singles` gives them a stem and their id ends "-q" (`9eb001-jun24-02-q`).
  From June 2025 the extracts are in a source booklet at the back ("Read Extracts A–F in the
  Source Booklet", "Source for use with SECTION B"): the cutter's patterns now take those
  wordings.
- **Schemes:** a 20-mark question's crop holds its indicative content and the levels grid,
  which Pearson prints on separate pages. Economics B's scheme tables put the question's words
  in their header row, so a page-closing header (the next question's, its first row overleaf)
  slipped past `cut_pearson.py`'s check and ended up under the question before: `cut_economics_b.py`
  cuts those off (34 of 252 crops). No row here is carried over a page with its label repeated
  ("contd"); if one turns up, the Pearson cutter's carry-over fix (`ms_carryover.py`) is the
  one to re-cut with.
- **Pipeline:** `edexcel_economics_b/` holds thin wrappers over the Pearson scripts:
  `fetch_economics_b.py`, `spec_economics_b.py`, `tag_economics_b.py` (tag.md's "Edexcel
  Economics B" section) and `build_economics_b.py`. The whole papers are the past paper
  library's copies (`scripts/past-papers/boards/edexcel_economics_b.py`,
  `edexcel/EDX-9EB0-<paper>-<kind>-<series>.pdf`), and `/past-papers/a-level-economics-b/edexcel`
  is the library page (Economics' first; `bankPapersPath` keeps Economics A and B on separate pages).
- **Gaps:** November 2021 had too few entries for an examiner's report ("Pearson will not
  publish an Examiner's Report"), so those three papers have none. June 2024 Paper 3's report
  has no readable text (its font carries no text mapping, as Economics A's), so its 8 parts
  have no comments. Paper 3's pre-release context booklets (a separate Pearson file, bound
  into the question paper from some years) are not hosted on their own.

```bash
python3 scripts/past-papers/boards/edexcel_economics_b.py            # fetch + library copies
python3 scripts/question-bank/edexcel_economics_b/spec_economics_b.py
python3 scripts/question-bank/edexcel_economics_b/cut_economics_b.py   # cut_pearson.py --extracts --stem-singles, plus one repair
python3 scripts/question-bank/edexcel_economics_b/tag_economics_b.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_economics_b/tag_economics_b.py merge
python3 scripts/question-bank/edexcel_economics_b/build_economics_b.py
python3 scripts/past-papers/upload.py edexcel-economics-b
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-economics-b --crops-only --checksum
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

## Edexcel GCSE Geography B

Added 31 October 2026: `/question-bank/edexcel-gcse-geography-b`, every question from Pearson
Edexcel's GCSE (9-1) Geography B (1GB0) Papers 1-3 that Pearson publishes on qualifications.pearson.com:
June 2018, June 2019, November 2020, November 2021 and June 2022 to June 2025. That is 721 parts
from 24 papers, every one with its own mark scheme crop and tagged to a key idea, and 666 with
the examiner's comments on its question.

- **Topics:** the specification's nine topics as tiles ("Topic 1: Hazardous Earth" … "Topic 9:
  Consuming energy resources") and their numbered key ideas under them ("1.4 Tropical cyclones
  are caused by particular meteorological conditions"). Topic 6, fieldwork, has no numbered key
  ideas: its four contexts (coasts, rivers, urban, rural) are its topics, coded 6.1-6.4 in the
  data and shown without a code. No AS split, so no year filter (`spec_gcse_geography.py`).
- **Choices:** Paper 2's Section C1 is Question 8 or 9 (coasts or rivers fieldwork), C2 Question 10
  or 11 (urban or rural); June 2022's shortened Paper 1 was Section A and then Section B or C. As in
  the A-Level bank no part is marked `or`; `check_gcse_geography.py` checks every question's parts
  against its printed total (SPaG included) and every section and paper total with the choices,
  and that every part's scheme crop opens on its own row: all 24 papers pass.
- **Figures:** Papers 1 and 2 print their figures in the paper, so a part's crop has them (and
  "Show question 2 so far" brings back a figure printed with an earlier part). Paper 3 is set on a
  Resource Booklet bound in after the paper: each question carries its section of the booklet as
  its stem ("Use Section B (page 5 and page 6) in the Resource Booklet"), and the 12-mark decision
  question (Question 4, "Use information from the Resource Booklet…") the whole booklet, about
  eleven pages, scaled to the 16,000px limit. Its id ends `-q` (`1gb003-jun24-04-q`).
- **Schemes:** read by `cut_pearson.py --extracts --figures` (unchanged) through
  `cut_gcse_geography.py`, which rewrites Geography B's label column first: from June 2023 Sections
  B and C set their labels in a narrower column ("2a" with "(i)" under it); some rows drop the
  question number ("b", "d (i)", "f  Award one mark…"); June 2024 Paper 1 prints a chart whose axis
  ("8 7 6 … 0") ran down the label column. Every 8- and 12-mark crop runs on to its levels grid and,
  where the question has SPaG, the SPaG grid (up to four pages). November 2020 Paper 3 prints 3(d)'s
  "Level 3" row under 3(e)(i)'s table on the next page: it is moved back to 3(d). November 2020
  Paper 2 prints "7 (a)" on a one-part question its scheme calls "7" (`labels/1gb002-nov20.json`).
  June 2018 Paper 2's Figure 7 legend has a column of bracketed counts, "(57)", "(54)": not marks.
- **Reports:** June 2024's three reports set their text in fonts with no character map, so they
  are read by OCR (`ocr.swift`, candidates' scripts whited out first), as Politics' are.
- **Tags:** Claude subagents tagged every part following `tag.md`'s "Edexcel GCSE Geography B"
  section. A question's topic is fixed by paper and number (`tag_gcse_geography.py` rejects
  anything else), so a student who skipped the coasts fieldwork never meets it under rivers.
- **Gaps:** June 2026 is for teachers only. Pearson's November 2020 Paper 2 report and much of
  November 2021 Paper 2's are written by section, not by question, so 55 parts have no comments.
  The specimen papers are left out, as for the other banks. There's no past paper library page
  for Geography B yet, so the credit links to `/past-papers`; the whole papers are on R2 under
  `edexcel/1gb0-*` for the bank's "whole paper" links. Topic 5.8 (the changing rural area) has no
  questions yet, and Paper 3's energy sections sometimes ask about an economy or climate change
  rather than energy itself, so those parts take the nearest Topic 9 key idea.

```bash
python3 scripts/question-bank/edexcel_gcse_geography/fetch_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/spec_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/cut_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/check_gcse_geography.py
python3 scripts/question-bank/edexcel_gcse_geography/tag_gcse_geography.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_gcse_geography/tag_gcse_geography.py merge
python3 scripts/question-bank/edexcel_gcse_geography/build_gcse_geography.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-gcse-geography --pdf-prefix=edexcel/
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

## Edexcel A-Level Politics

Added 29 October 2026, after the founder asked for Politics on the most common board:
`/question-bank/edexcel-a-level-politics`, every question from Pearson Edexcel's A-Level (9PL0:
Paper 1, Paper 2, and Paper 3A USA or 3B Global) and AS (8PL0, Papers 1 and 2) Politics papers
that Pearson publishes on its own site, 2019 to 2025. That is 296 parts from 40 papers (7 series
of the A-Level, 6 of the AS), every one with its own mark scheme crop (the levels grid, then its
indicative content), and 284 with the examiner's comments on its question. Every paper's parts add
up to its printed total, counting each either/or choice once (`check_politics.py`).

- **Papers:** Paper 3 is two papers, 3A and 3B, of which a student sits one. Each is a paper of its
  own (`9pl03a`, `9pl03b`, "Paper 3A · Comparative Politics: USA"), so the paper filter picks one,
  and their topics sit under the tiles' "Paper 3 options": USA (Paper 3A) and Global Politics
  (Paper 3B).
- **Topics** are the specification's content areas (Issue 4), in six areas: UK Politics (democracy
  and participation, parties, electoral systems, voting behaviour and the media), Core Political
  Ideas (liberalism, conservatism, socialism), UK Government (constitution, Parliament, PM and
  executive, relations between the branches), Non-core Political Ideas (anarchism, ecologism,
  feminism, multiculturalism, nationalism), USA (six) and Global (six). Essays range across an
  area's numbered sub-points, so the bank tags to content areas. The specification numbers them
  afresh in each area, so codes carry the area (`UKP.2`) and topics show their names alone.
  UK Politics and UK Government are Year 1 (the AS), the ideas Year 2.
- **Either/or:** every question is "EITHER 1(a) OR 1(b)" (Paper 3's Section C: two of three), so
  every part after a question's first carries `or` and a whole question's marks count one essay.
  Paper 2's Section B is one question per non-core idea (3 Anarchism … 7 Nationalism on every paper).
- **Sources:** before 2023 each source is printed in its part, so the part's crop has it. From June
  2023 they are in a Source Booklet bound in after the paper; the question that says "Look at Source
  1(a)…" or "Read Sources 2 and 3…" carries them as its stem. The bank shows a question's stem once
  above its parts, so an "EITHER 1(a) OR 1(b)" question's stem has both sources, each under its own
  heading. AS Questions 2 and 3 have no parts, so their ids end `-q` (`8pl001-jun24-02-q`), as
  Geography's, for the stem's name.
- **Cutting:** `cut_politics.py` runs `cut_pearson.py --extracts --figures` with Politics' own
  pieces, patched from the wrapper so no other bank's crops move: older papers print the number again
  before the alternative ("1 (b)", "3 (b)"), read as the next part; the source booklet's stems; and
  its own mark scheme reader. Pearson's Politics schemes have no one layout (a levels grid before the
  indicative content or after it, labels "1(a)", "1a", "2a.", "4b)", "Question number 3", or none),
  so each part's crop runs from its label to the next landmark, after its "Guidelines for marking…"
  block. AS Paper 2 June 2022 prints 4(b)'s label as "4a": its start is set by hand (`MS_HAND`).
- **Reports:** headings like "Q1a Using the source…" go on lines of their own before cut_pearson
  reads them. A-Level Paper 1 and Paper 3B June 2024 set their text in fonts with no character map,
  so they are read by OCR (`ocr.swift`), with the candidates' scripts (pictures) whited out first.
- **Tags:** Claude tagged every part following `tag.md`'s "Edexcel Politics" section.

Gaps, honestly:

- No exams in June 2020 or June 2021 (cancelled); October 2020 and November 2021 were sat instead.
  AS wasn't sat in November 2021, so Pearson has no AS set for it.
- Pearson published no examiner's report for either AS paper in October 2020 ("insufficient
  entries"): those 12 parts have the scheme but no report.
- The two OCR'd reports (June 2024 Paper 1 and 3B) may have the odd misread word.
- Not included, by the brief's 2019–2025 scope: AS June 2018 (AS's first sitting, public on
  Pearson's site, could be added) and June 2026 (listed, but in Pearson's teachers-only area). The
  specimen papers are teachers-only too.
- Scheme crops are long (a levels grid plus up to four pages of indicative content); the longest,
  3B November 2021's essays, are 9,000–10,700px.
- No past paper library page for Politics yet (`FILES_JSON = None`), though the whole papers are on
  R2 under `edexcel/` for the bank's "whole paper" links.

```bash
python3 scripts/question-bank/edexcel_politics/fetch_politics.py
python3 scripts/question-bank/edexcel_politics/spec_politics.py
python3 scripts/question-bank/edexcel_politics/cut_politics.py
python3 scripts/question-bank/edexcel_politics/check_politics.py
python3 scripts/question-bank/edexcel_politics/tag_politics.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_politics/tag_politics.py merge
python3 scripts/question-bank/edexcel_politics/build_politics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-politics --pdf-prefix=edexcel/
```

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

## AQA GCSE Geography

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

## OCR A-Level Economics

Added 28 October 2026: `/question-bank/ocr-a-level-economics`, every question from the
OCR A-Level (H460, Papers 1–3) and AS (H060, Papers 1–2) Economics papers that OCR
publishes on its own site. That covers A-Level November 2021 and June 2022 to June 2025, and AS
June 2022 to June 2025. That is 478 parts from 23 papers. Every part has its mark scheme cropped,
all 270 multiple-choice questions also carry their answer letter, and 269 parts have the
examiner's comments. Every paper adds up to its 80 (A-Level) or 60 (AS) marks, counting
one essay of each choice.

- **Case material.** A-Level Papers 1 and 2 open Section A with stimulus material, and AS
  Section B opens with a case study. Paper 3's Section B has three extracts. Up to June 2023
  all three come before the questions; from June 2024 each comes before its own questions.
  Each block runs from its heading ("Section B", "Read the extracts…", "Extract 2") to the
  next question. It is the stem ("Show how question 1 starts") of every question after it
  until the next block or section, and a part's crop stops where the next block begins.
  Paper 3's extract questions have no parts, so they are named for the block they share:
  `h46003-jun24-e2-34`, stem `h46003-jun24-e2-stem.webp`. A downloaded set prints each
  extract once. Because those ids carry a block, the bank keys its reports by part
  (`reportsBy: "question"`): each part carries its question's report, and the page leads
  with the part's own heading.
- **Crops end at the question.** A part is shown down to its first answer line. Where its
  marks sit at the end of the lines ("........ [8]"), that one line is shown under it.
- **Essay choices.** "Answer Question 2 or Question 3" (and 4 or 5, and AS 17 or 18): the
  second carries `or`. OCR's scheme prints both essays' headings over one levels table,
  then "Question 2* Guidance" and "Question 3* Guidance". Each essay's scheme crop is its
  own heading, the shared levels, and its own guidance.
- **Multiple choice.** Paper 3 questions 1–30 and AS 1–15. The scheme crop is the question's
  row of OCR's rationale table. The letter is read from the two-column key table where
  there is one, and otherwise from the row's Key column (past the tick some rows carry).
  The key table itself is not read as a scheme. All 270 letters match OCR's key tables
  where OCR prints one.
- **Topics.** The specification numbers each component from 1, so the codes put the
  component first. The sections are "Microeconomics 2: The role of markets" (`1.2`) and its
  topics, such as "2.6 Elasticity" (`1.2.6`, with `ref` "2.6" as printed). There are 10
  sections and 49 topics. A topic is Year 1 · AS where the AS specification has a topic of
  the same name (27 of them). AS questions take the A-Level's codes. Component 3 has no
  content of its own. Every part is tagged (tag.md's "OCR Economics" section; corrections in
  `tag/overrides.json`). No question tests Macroeconomics 2.6, Trends in macroeconomic
  indicators, on its own.
- **Pipeline.** `scripts/question-bank/ocr_economics/` holds:
  - `fetch_ocr_economics.py`: OCR's assessment page, read with `fetch_ocr_cs.py`'s reader.
  - `spec_ocr_economics.py`.
  - `cut_ocr_economics.py`: `cut_pearson.py` as a library, patched for this run only, so
    `cut_pearson.py` is unchanged.
  - `tag_ocr_economics.py`.
  - `build_ocr_economics.py`.

  Whole papers are on R2 under `ocr/` (`OCR-H460-01-QP-JUN24.pdf`, the library's naming),
  and crops are under `bank/h460*` and `bank/h060*`.
- **OCR's own slips, handled.** AS Paper 2 June 2025's scheme numbers question 2's row "1",
  so it is renumbered. That scheme also sets question 18's heading as a sentence ("18.
  Evaluate…") outside its table, so the heading is split off. Its assessment-objective grid
  at the back is left unread.

**Gaps:**
- OCR publishes only the series above. Older series sit on Teach Cambridge, OCR's teacher
  login, and are not fetched. These include the 2015 specification's papers and any AS
  series before June 2022. No mirror (PMT or other) is used: that needs the founder's
  say-so.
- The sample assessment materials are left out, as for the other OCR banks.
- OCR published no examiners' reports for November 2021 (all three papers) or AS June 2022,
  so 46 written parts have no comments.
- The AS reports don't discuss the multiple-choice questions. Paper 3's reports comment
  only on the multiple-choice questions candidates found hardest or easiest, so 107 of the
  270 have comments.
- June 2022 Papers 2 and 3 have OCR "post exam corrections", which are notices and not
  new papers. The crops show the papers as printed. In Paper 2's Fig. 3, "2009 4.9%"
  belongs in the "within margin" ring, not "outside target". In Paper 3's Extract 3, the
  last sentence of the first paragraph should say Fig. 3.1, not Fig. 3.2. Both notices
  are in the work folder (`h460-0[23]-corr-jun22.pdf`).
- There's no past paper library page for Economics yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/ocr_economics/fetch_ocr_economics.py
python3 scripts/question-bank/ocr_economics/spec_ocr_economics.py
python3 scripts/question-bank/ocr_economics/cut_ocr_economics.py
python3 scripts/question-bank/ocr_economics/tag_ocr_economics.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_economics/tag_ocr_economics.py merge
python3 scripts/question-bank/ocr_economics/build_ocr_economics.py
mkdir -p scripts/question-bank/.work/ocr-economics/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-economics/r2 --pdf-prefix=ocr/
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-economics --crops-only
```

## OCR A-Level Law

Added 29 October 2026: `/question-bank/ocr-a-level-law`, every question from the OCR A-Level
(H418, Papers 1–3) and AS (H018, Papers 1–2) Law papers that OCR publishes on its own site:
June 2022, the specification's first exams, to June 2025. That is 208 questions from 24 papers
(16 A-Level, 8 AS). Every question has its mark scheme cropped and its examiner's comments, and
every paper adds up to its 80 (A-Level) or 64 (AS) marks, counting one question of each choice
and one Part of Section B.

- **The option.** Component 3 is two papers: H418/03 (the nature of law and human rights) and
  H418/04 (the nature of law and the law of contract). A student sits one. They are named
  "Paper 3 (Human rights)" and "Paper 3 (Contract)", so the paper filter picks a student's option,
  and their Section B topics are year 3, listed under "Paper 3 options" in the topic list. The
  bank's note says so.
- **Questions are whole.** There are no parts and no answer lines (candidates write in a booklet).
  A question's crop ends at the line its marks are on, so it doesn't run on into the next
  Part's heading or, after the last question, OCR's copyright page.
- **Scenarios as stems.** Each A-Level Section B is "Choose Part 1 or Part 2", and each Part opens
  with two unrelated scenarios, then three questions: two "Advise…" questions on them and an
  essay. The AS Section B opens with one scenario ("Read the scenario.") and asks four questions,
  two of them "Advise…". The block, from its heading to its first question, is the stem of each
  "Advise…" question in it. The "Explain…" questions ("Do not refer to the scenario") and the
  essays have none. The scenario questions are named for their block, so they share one stem:
  `h41801-jun24-p1-05`, stem `h41801-jun24-p1-stem.webp`; the AS block is `sc`
  (`h01801-jun24-sc-06`). 80 questions have a stem. Reports are keyed by question
  (`reportsBy: "question"`).
- **Mark schemes.** Section A's scheme is a table, a row per question. Section B's are pages of
  indicative content and level grids under a heading ("5. Advise whether Kobe…", "5", "Q3",
  "7* and 10*"), with numbered lists of points among them. So `cut_ocr_law.py` finds each
  question's scheme by its own words: the first heading after the last question's that carries
  its number at the left margin and, there or just under it, most of the question's opening
  words. Failing that, its bare number. The crop runs to the next question's heading, the
  "Section B" heading, the assessment-objectives grid or OCR's back page. The Section A table's
  header row comes with it. The second Part's essay is the first Part's again, and its scheme
  says only "As per question 7" (or "SEE ABOVE FOR Q5*"), so it shows Question 7's crop.
- **Choices.** "Answer Question 1 or Question 2" (2023 on), "Answer one question from questions
  1–2" (June 2022), and Paper 3's "Answer one question" over Questions 1 and 2: the second
  carries `or`. 24 questions.
- **Reports.** Every question has its report. The second Part's essay takes the first's where
  OCR writes one report on both ("Question 7* and Question 10*"), or reports only once. H418/01
  June 2022 heads its Question 8 report "Questions 8/9" (Question 9 has its own); it is read as
  Question 8.
- **Topics.** The specification's content tables have bold topic headings with no numbers
  ("Fatal offences against the person"), so they're coded by section (`1B.3`) with an empty
  `ref`. There are 7 sections (the legal system, criminal law, law making, tort, the nature of
  law, human rights, contract) and 44 topics. The nature of law is printed for both Paper 3s and
  read once. Where two sections share a topic name, the title says whose ("Criminal law: rules
  and theory", "Tort: remedies"). 20 topics are Year 1 · AS (the AS specification has a topic of
  the same name; its "Rules" is the A-Level's "Rules and theory", and its "Introduction to the
  nature of law" opens its legal system), 11 are A-Level only and 13 are the Paper 3 options.
  Every question is tagged by reading it (tag.md's "OCR Law" section). Essays carry the
  section's evaluation topic second. No question tests the "rules and theory" topics of tort,
  human rights or contract.
- **Pipeline.** `scripts/question-bank/ocr_law/` holds:
  - `fetch_ocr_law.py`: OCR's assessment page, read with `fetch_ocr_cs.py`'s reader.
  - `spec_ocr_law.py`.
  - `cut_ocr_law.py`: `cut_pearson.py` as a library, patched for this run only, so
    `cut_pearson.py` is unchanged.
  - `tag_ocr_law.py`.
  - `build_ocr_law.py`.

  Whole papers are on R2 under `ocr/` (`OCR-H418-01-QP-JUN24.pdf`, the library's naming), and
  crops are under `bank/h418*` and `bank/h018*`.

**Gaps:**
- OCR's page lists only June 2022 to June 2025, for both levels. That is every exam series of
  this specification so far (there are no November series, and the AS's first exams, June 2021,
  were not sat). The legacy specification's papers are not on this page and are not fetched. No
  mirror (PMT or other) is used: that needs the founder's say-so.
- The sample assessment materials and modified papers (zips) are left out, as for the other OCR
  banks.
- Questions appear more than once where OCR prints them more than once: both Paper 3s share
  Section A (16 questions, 8 of them repeats), and every A-Level paper sets the same essay in
  Part 1 and Part 2 (16 repeats). They are kept, as English Literature keeps its shared Section B,
  so each paper is whole under the paper filter.
- There's no past paper library page for Law yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/ocr_law/fetch_ocr_law.py
python3 scripts/question-bank/ocr_law/spec_ocr_law.py
python3 scripts/question-bank/ocr_law/cut_ocr_law.py
python3 scripts/question-bank/ocr_law/tag_ocr_law.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_law/tag_ocr_law.py merge
python3 scripts/question-bank/ocr_law/build_ocr_law.py
ln -sfn ../img scripts/question-bank/.work/ocr-law/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-law/r2 --pdf-prefix=ocr/
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
  2023 and November 2021. Specification B is its own bank, below.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py a-level
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=a
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py --level=a
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-a
```

### AQA A-Level English Literature B

Added 29 October 2026: `/question-bank/aqa-a-level-english-literature-b`, every question from
AQA's A-Level (7717) and AS (7716) English Literature B papers that AQA still publishes,
November 2020 to June 2025. That is 327 questions (228 A-Level, 99 AS) from 42 papers, every
one with its mark scheme cropped and 238 with the examiner's comments. The same scripts with
`--level=b` (`fetch_english_lit.py a-level-b`).

- **Options are genres, and papers.** Each paper is sat as one of two options, and AQA gives
  each its own component: A-Level Paper 1A Aspects of tragedy, 1B Aspects of comedy, 2A
  Elements of crime writing, 2B Elements of political and social protest writing; AS Paper
  1A/1B (drama) and 2A/2B (prose and poetry) in tragedy or comedy. So the paper filter has
  eight papers, and the topic tiles are the four genres.
- **Topics are the set texts, within their genre.** A question is tagged from its heading
  ("Othello – William Shakespeare") against its option's genre only (`texts.for_option`).
  Texts that A-Level students write about only in Section C (Richard II, The Great Gatsby,
  Emma and the rest) have named questions only on the AS papers, so their topics say "(AS)".
  The questions that name no text are their genre's own topics (`texts.unheaded`): Paper
  2's unseen extract (Section A: "Unseen crime extract", "Unseen protest extract") and the
  A-Level's two-text questions (Section C: "Tragedy across two texts" and so on). The
  Merchant's Prologue and Tale has had no question since 2020, so it has no tile.
- **Whole questions, extract included,** as at GCSE: a question runs from its label to the
  next "or", heading or label, so the extract printed under a Paper 1 Section A or AS
  question, and Paper 2's unseen extract, come with it. Section C's ids are
  `77171a-jun24-c-07`, and their stem is the section's rubric with its list of texts
  (`77171a-jun24-c-stem.webp`). Other ids are `77172a-jun24-01`.
- **Either/or.** In each section every question after the first carries `or` (Paper 2's
  Section A is one question), so every paper adds up to its 75 (AS: 50).
- **Mark schemes** print each question's label in a box, as the papers do: a question's
  indicative content runs to the next label, with the one levels grid ("Band 5 … How to
  arrive at (a) mark", landscape, portrait in AS June 2022) stacked under it. AS Paper 2A
  and 2B June 2022 print the label's two boxes one over the other (`stacked_labels`).
- **Reports** head a question ("Question 1", "Question 1: The Taming of the Shrew") or a
  section (Paper 2's), and a question gets its own paragraphs, else its section's that name
  its text, else the section's general ones. June 2025's reports set their headings in a
  medium weight, read as bold for B.
- **Pipeline:** `aqa_english_lit/` as above with `--level=b`; GCSE and Specification A are
  unchanged (their Paper 2 cuts are byte-identical before and after). Papers are on R2 under
  `aqa/AQA-771[67]*`, crops under `bank/771[67]*`.
- **Gaps:** AQA no longer publishes 2017–2019 (or AS 2016–2019), and its file store has
  none, so the bank starts at November 2020; the specimens are left out. AQA publishes no
  AS Paper 1B or 2B for November 2020 and sat no AS papers in November 2021. There are no
  reports for November 2020 or 2021 (87 questions), and the AS Paper 1A reports of June 2022
  and 2023 skip A Streetcar Named Desire (2 questions). AQA's copies withhold three extracts
  for copyright, and those crops show AQA's note: Paper 2A June 2022's unseen extract, AS
  Paper 2A June 2022's Poetry Anthology: Tragedy poem and AS Paper 2B June 2025's Poetry
  Anthology: Comedy extract. The questions are all there.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py a-level-b
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py --level=b
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py --level=b
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-b
```

### Edexcel A-Level English Literature

Added 31 October 2026: `/question-bank/edexcel-a-level-english-literature`, every question from
Pearson's A-Level (9ET0) and AS (8ET0) English Literature papers on its own site: A-Level June
2017 to June 2025 (with October 2020 and November 2021), AS June 2016 to June 2025 (with October
2020). That is 900 questions from 45 papers, every one with its mark scheme cropped and its levels
grid stacked under it, and 684 with the examiner's comments. Scripts in
`scripts/question-bank/edexcel_english_lit/` (fetch, cut, build, texts).

- **Topics are the set texts** (`texts.py`), read from the heading over each pair of questions:
  Paper 1's Shakespeare plays (Section A) and other drama (Section B, and AS Paper 1 Section B),
  Paper 2's six prose themes (Childhood, The Supernatural and the rest, and AS Paper 2), and Paper
  3's poetry collections and poets ("Metaphysical Poet: John Donne" is Donne's, "The Metaphysical
  Poets" the anthology's). Poems of the Decade (Paper 3 Section A, AS Paper 1 Section A) has no
  heading, so it's tagged by section.
- **Either/or.** Every question in a section after its first carries `or`, so the papers add up
  to their covers' 60, 40 and 60 (AS 72 and 44).
- **Stems.** Where a heading carries more than a name, a prose theme's texts or a collection's
  prescribed edition, it's the stem of its two questions (`9et002-jun24-childhood-01`, stem
  `9et002-jun24-childhood-stem.webp`). Paper 3 Section A's unseen poem, from the source booklet,
  is the stem of both its questions (`9et003-jun24-unseen-01`).
- **The source booklet** is bound into Paper 3's question paper; `fetch_english_lit.py` splits it
  out as the paper's insert (`edexcel/EDX-9ET0-03-INS-JUN24.pdf`), linked from Section A's
  questions ("Sources (insert)") and shown in the library's Insert column.
- **Mark schemes** give each question a row of "Question number | Indicative content"; the levels
  grids follow a section's questions (each text's pair in the early schemes, before Section B's in
  June 2022), and a question takes the grid after it, else the one before. June 2025's schemes
  carry no font names, so nothing reads as bold there.
- **Reports** are headed per question ("Question 7", "Question 1 & Question 2", AS June 2022's
  "Question Two"); each question gets the text under its heading, capped at about 6,000
  characters. Gaps: Paper 1 June 2024's report has no readable text, the November 2021 and October
  2020 reports cover a few questions, AS June 2016 Paper 1 has none, and October 2020's AS reports
  are a page saying there is none (left out).
- **Whole papers** are the library's copies (`edexcel/EDX-9ET0-*`, `EDX-8ET0-*`); crops are under
  `bank/9et00*`, `bank/8et00*`. June 2026 is teachers only.

### OCR A-Level English Literature

Added 31 October 2026: `/question-bank/ocr-a-level-english-literature`, every question from OCR's
A-Level (H472) Components 1 and 2, November 2021 and June 2022 to June 2025, and AS (H072)
Components 1 and 2, June 2022 to June 2025, from OCR's own site. That is 325 questions and parts
from 18 papers, every one with its mark scheme and level descriptors, 281 with the examiner's
comments. Scripts in `scripts/question-bank/ocr_english_lit/`; `build_english_lit.py` uses the
Edexcel builder's `build()`.

- **Parts.** A Shakespeare question on H472/01 is two parts, both answered ("And"): (a) on a
  printed passage, which comes with it, and (b) on the play as a whole (`h47201-jun24-01-a`, label
  "1(a)"). On the AS papers a question's parts are alternatives ("Either (a) ... Or (b)").
- **Topics** are the set texts (`texts.py`). H472/02 is sat on one of five topics (American
  Literature 1880–1940, The Gothic, Dystopia, Women in Literature, The Immigrant Experience), each
  with an unseen passage and a comparative essay led by one of two core texts, (a) or (b), or by
  none, (c): the unseen passage and the open essay are each topic's own tiles. H472/01 Section 2
  (a drama and a poetry text compared) is one tile. The AS prose texts are H472/02's core texts,
  and the AS poetry texts H472/01 Section 2's, so they share tiles.
- **Either/or.** Every question in a section after its first carries `or`, as does a part after
  "Or"; on H472/02 the four topics after the first are alternatives whole. Every paper adds up to
  60.
- **Stems.** H472/02's list of texts for a topic is the stem of its essay's three parts
  (`h47202-jun24-02-stem.webp`); H472/01 Section 2's list of drama and poetry texts is the stem of
  its questions (`h47201-jun24-s2-07`).
- **Mark schemes** give each question or part its own table; the level descriptors printed once a
  section (on H472/01 once for each Section 1 part, on H472/02 once for the unseen passages and once
  for the essays) are stacked under it.
- **Reports** head each question or part ("Question 1 (a)"). November 2021's reports go by section,
  so its questions have none.
- **Whole papers** are the library's copies (`ocr/OCR-H472-*`, `OCR-H072-*`); crops under
  `bank/h472*`, `bank/h072*`. Component 3 is coursework, with no paper.

## AQA GCSE English Language

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

## WJEC Level 3 Criminology

Added 29 October 2026, after the founder asked for "wjec crim". It is WJEC's Level 3 Applied
Diploma in Criminology (4543), a vocational Level 3 rather than an A-Level, so its bank has a
`level` of its own, `"Level 3"`. The hub puts it on a "Level 3 vocational (Applied Diploma)"
shelf after the A-Level shelves, jump link "Level 3". The homepage's bank index lists it under
WJEC as "Level 3", after its A-Levels. `bankTitle` gives "WJEC Level 3 Criminology", and
`fullName` gives "Applied Diploma in Criminology" in the bank page's lead.

`/question-bank/wjec-criminology` has 246 parts from WJEC's 18 published papers, every one
tagged and every one with its own mark scheme crop and its scenario as a stem:
- Unit 2 (Criminological Theories, 4543UB0) and Unit 4 (Crime and Punishment, 4543UD0).
- Summer 2017, 2018, 2019, 2022, 2023, 2024 and 2025, Autumn (October) 2020 and January 2022.
- 218 parts have the examiner’s comments: every one but Summer 2017’s.

Units 1 and 3 are controlled assessments, not exams, so they aren't in the bank.

- **Papers:** three 25-mark questions, each a scenario ("1. Scenario: Richard and Geta are…")
  and then "(a)", "(b) (i)", which `cut_wjec.py` reads as they are, the scenario as the stem.
  Every part is written in the booklet, so `wjec/cut_wjec_criminology.py` ends each crop just
  under its marks ("[6]"), leaving out the dotted lines and "Additional space for Question
  1(a) only".
  - Summer 2017's Unit 4 numbers the answer lines of three "give two" questions "(i)" and
    "(ii)": those are cut as the one part the scheme marks (2(c) [10], 3(a) and 3(b) [4]).
  - Every paper adds up to 75.
- **Schemes:** 2017–2019's are ruled tables ("Question | Answer | Mark | LO"), which
  `cut_wjec.py` reads. From Autumn 2020 each part is a block: its label in the margin, the
  question again, the levels grid and the indicative content.
  - The wrapper reads these blocks by the label's column ("1." at x 72, "(a)" at 108, "(i)" at
    144). From 2023 the letter is printed again beside each sub-part.
  - Summer 2023's Unit 2 scheme lists every question first and then the blocks: a label's last
    block is its own.
  - WJEC lists two Summer 2017 Unit 2 schemes. They match except that the `4543UB0` copy
    corrects Sheldon's somatotypes, and it is the one kept.
  - The list files the 2019 schemes under "Autumn". `fetch_wjec.py` reads Criminology's series
    off each cover instead.
- **Reports:** one a series for the whole qualification, a section a unit, comments headed
  "Q.1". The contents page's last line, "Unit 4 – Crime and Punishment", runs straight into the
  general comments, so the wrapper hands `cut_wjec.py`'s reader the report from the unit's own
  heading on. 2019 also has a two-page "Summary Report"; the full report is used.
- **Topics:** `wjec/spec_wjec_criminology.py` reads the Diploma specification. (WJEC also lists
  the Applied Certificate's, which covers only Units 1 and 2; `fetch_wjec.py` skips it.)
  - Sections are the learning outcomes, "Unit 2, LO1: Understand social constructions of
    criminality".
  - Topics are the assessment criteria, with the titles from the assessment grids: 10 a unit,
    20 in all, coded `2.1.1` with `ref` "AC1.1" so the pages show the AC.
  - The 246 parts were tagged by reading them (tag.md's WJEC section), one AC each, one with
    two. Each part takes only its own unit's ACs.
- **Papers' names:** "Unit 2 · Criminological Theories", "Unit 4 · Crime and Punishment";
  series "Summer 2025", "January 2022", "Autumn 2020". `noCalc` hides the calculation filter.
- **Gaps, honestly:**
  - WJEC publishes no examiners' report for Summer 2017, so those 28 parts have none.
  - No series ran in 2021, and none is published for Summer 2026: the paper list ends at 2025,
    though the key documents already carry the Summer 2026 report.
  - The Sample Assessment Materials for Units 2 and 4 aren't in the bank.
  - The on-screen versions (4543UA0/UC0) are the same papers and aren't repeated.
  - The Welsh-medium papers aren't included.
  - Tags are one reader's, not three.
- **Pipeline** (its own work dir, `.work/wjec-criminology`):

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py scripts/question-bank/.work/wjec-criminology --only=criminology
python3 scripts/question-bank/wjec/cut_wjec_criminology.py scripts/question-bank/.work/wjec-criminology
python3 scripts/question-bank/wjec/spec_wjec_criminology.py scripts/question-bank/.work/wjec-criminology
python3 scripts/question-bank/wjec/tag_wjec.py split scripts/question-bank/.work/wjec-criminology 300   # then tag, merge
python3 scripts/question-bank/wjec/build_wjec.py scripts/question-bank/.work/wjec-criminology
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec-criminology --pdf-prefix=wjec/
```

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

## Eduqas AS and A Level Religious Studies

Added 29 October 2026, at the founder's request ("eduqas re"):
`/question-bank/eduqas-a-level-religious-studies`, every question from Eduqas's AS (B120QS)
and A Level (A120QS) Religious Studies papers published on eduqas.co.uk, June 2017 to June
2025. That's 1,120 parts from 112 papers: 600 A Level parts (60 papers, June 2018 on) and
520 AS (52 papers). Every part has its mark scheme cropped, apart from one where Eduqas's
scheme answers a different question. 816 parts carry the examiner's comments on their
question, and every part is tagged.

- **Papers and options.** A student sits three components. Component 1 (a study of a
  religion) has a separate paper for each option: A Christianity, B Islam, C Judaism,
  D Buddhism, E Hinduism, F Sikhism (`a120ua0` … `a120uf0`, AS `b120ua0` …). Components 2
  (Philosophy of Religion, `a120u20`) and 3 (Religion and Ethics, `a120u30`) are sat by
  everyone. Each option is a paper of its own ("Component 1B · Islam"), and carries an
  `option`. The bank lists its religions in `options`, and the page gets a **Religion**
  filter beside Paper. Picking one keeps that religion's Component 1 papers and topics,
  plus Components 2 and 3. It also narrows the Paper list and the topic tiles. The filter
  is in the URL as `?option=B` and is hidden on topic pages. Any bank can use it: a paper
  or section without an `option` shows under every choice (`BankPaper.option`,
  `BankSection.option`, `BankSubject.options` in `src/content/questionBank.ts`).
- **Parts.** Every paper has five questions, each in two parts. Section A is questions 1–2,
  answer one; Section B is questions 3–5, answer one. Part (a) is AO1 knowledge (20 marks at
  A Level, 25 at AS) and part (b) is an AO2 evaluation of a quotation (30 marks, 25 at AS).
  A part's crop runs from its label to the next label or "Or,". Ids look like
  `a120ub0-jun24-03-b`, and labels like "3(b)". Reports are keyed by question; both parts
  share one. There are no calculations, so `noCalc` is set.
- **Mark schemes.** Each part's crop is its indicative content with the generic band
  descriptors for its assessment objective stacked underneath (AO1 for (a), AO2 for (b)).
  The descriptors are the levels the essay is marked on, and the scheme prints them once,
  at the front. AS Hinduism's June 2018 scheme prints no descriptors, so it borrows them
  from another AS scheme of that summer; they're generic and identical.
- **Topics.** These come from the A Level specification (`eduqas_rs/spec_eduqas_rs.py`).
  The eight areas are the sections: the six religions, Philosophy of Religion (`P`) and
  Religion and Ethics (`R`). Each area has four themes of six sections, A–F, and each
  section is a topic: 192 topics, coded like `B.2D` with ref "2D" (Islam, Theme 2D, Salah).
  AS papers are tagged to the same topics. A topic is year 1 (AS) when the AS
  specification teaches it, matched by its words, because the AS numbers its themes
  differently (AS Islam's Theme 3A is the A Level's 2D). Every area has 12 AS topics. One
  hand fix: R.2F, applying Finnis and Proportionalism, shares words with AS Natural Law but
  is A Level only. Tagging was done by Claude subagents reading each part
  (`eduqas_rs/tag_eduqas_rs.py`, tag.md's "Eduqas Religious Studies"). The reports for
  2024 and 2025 name each question's theme, and the tags agree with every one of them.
  23 parts have two topics; 4 topics have no questions yet (B.3C, C.3A, F.3F, F.4D).
  A topic's title is its heading as a student would know it ("Aquinas’ Natural Law: virtues
  and goods", "Muhammad in Makkah"), from `SHORT` in `spec_eduqas_rs.py`. The specification's
  own wording can run on into a paragraph, which made 600-character slugs that broke the
  production build. That wording stays in the topic's text in `spec.json`, for tagging.
  Titles shared across religions name their religion ("Festivals and Jewish identity"), and
  every slug is under 50 characters.
- **Pipeline.** `scripts/question-bank/eduqas_rs/`:
  - `fetch_eduqas_rs.py` reads the qualification page's pastpapers and keydocuments tabs,
    as `eduqas/fetch_eduqas.py` does. It places each file by its listed title, checked
    against the code in the file name and the PDF's cover. Pre-2023 files are named by old
    paper numbers (`s19-8121-04.pdf` is A Level Option B), and 2017's schemes only by a
    running number.
  - `spec_eduqas_rs.py`.
  - `cut_eduqas_rs.py` is self-contained, because the layout is the same every year; the
    shared cutters are untouched.
  - `tag_eduqas_rs.py`.
  - `build_eduqas_rs.py`.

  On R2, the papers are under `eduqas/a120*`, `eduqas/b120*` (reports
  `eduqas/a120-er-jun24.pdf`, one per level and series), and the crops under `bank/a120*`,
  `bank/b120*`.
- **Gaps (as Eduqas publishes them):**
  - Eduqas doesn't publish every option every year; low-entry options are left out. Not
    on the site:
    - A Level Sikhism, June 2024.
    - In Autumn 2021, every option except Christianity, Islam and Buddhism (Judaism,
      Hinduism and Sikhism).
    - AS Sikhism, June 2017, 2022, 2023, 2024 and 2025.
    - AS Judaism, June 2022 and 2025.
    - AS Hinduism, June 2023.
    - AS Autumn 2020, Options C–F: their mark schemes are listed but their papers aren't.

    These papers are on Eduqas's secure site only.
  - June 2026 papers aren't up yet (Eduqas waits a year), though the June 2026 reports are.
    They're left out until the papers follow.
  - Reports (816 of the 1,120 parts have comments):
    - Autumn 2021 has none at either level, and AS Autumn 2020 has none. A Level Autumn
      2020 covers only Components 2 and 3.
    - Some options get no section, or a summary with no per-question comments:
      - A Level Sikhism in 2022, 2023 and 2025.
      - A Level Judaism and Hinduism in 2025.
      - AS Sikhism in 2018 and 2019.
      - AS Judaism in 2019, 2023 and 2024.
      - AS Hinduism in 2022, 2024 and 2025.
    - AS 2025's Christianity and Buddhism comments couldn't be placed: the report runs
      them on without headings that match, so those 20 parts show none rather than risk
      the wrong ones.
    - A question that "worked well" is sometimes skipped; Eduqas says so in each report.
      Two questions miss out this way: A Level Ethics 2018 Q2 and Philosophy Autumn 2020 Q3.
    - Every comment was checked against its question's words.
  - Eduqas's June 2018 A Level Sikhism scheme prints a gurdwara question under 4(b), but
    the paper's 4(b) is about festivals. That part has no scheme crop (`WRONG_SCHEME` in
    `build_eduqas_rs.py`) and links the whole scheme PDF instead.
  - No sample assessment materials are included, as with the other banks.

```bash
python3 scripts/question-bank/eduqas_rs/fetch_eduqas_rs.py
python3 scripts/question-bank/eduqas_rs/spec_eduqas_rs.py
python3 scripts/question-bank/eduqas_rs/cut_eduqas_rs.py
python3 scripts/question-bank/eduqas_rs/tag_eduqas_rs.py split   # tag the batches, then:
python3 scripts/question-bank/eduqas_rs/tag_eduqas_rs.py merge
python3 scripts/question-bank/eduqas_rs/build_eduqas_rs.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-rs --pdf-prefix=eduqas/
```

## Eduqas GCSE Religious Studies and History

Added 30 October 2026, after a student asked for "eduqas rs and history gcse":
`/question-bank/eduqas-gcse-religious-studies` and `/question-bank/eduqas-gcse-history`.
They hold every question from Eduqas's GCSE (9-1) Religious Studies (C120, full course,
Routes A and B) and History (C100) papers published on eduqas.co.uk, June 2018 to June 2025,
including the Autumn 2020 and 2021 resits.

- Religious Studies: 632 parts from 71 papers, all tagged. Every part has its mark scheme
  cropped, and 352 carry the examiner's comments on their question.
- History: 640 parts from 116 papers, all tagged. Every part has its mark scheme cropped,
  289 have their sources or interpretations as a stem, and 533 carry the examiner's
  comments.

- **Papers and options.** Every option is a paper of its own, so both banks use the
  `options` filter that Eduqas A Level Religious Studies added. No new page code was needed.
  - Religious Studies:
    - Route A: Component 1 (`c120u10`, the four themes), Component 2 (`c120u20`,
      Christianity) and Component 3, one world faith (`c120u30` Buddhism … `c120u70`
      Sikhism).
    - Route B: Components 1 and 2 (`c120u80`, `c120u90`, Catholic theology). Its
      Component 3 is Route A's Judaism paper.
    - The **Religion** filter picks Component 3's faith (`?option=is`). It keeps that paper
      and every other paper; it doesn't separate the routes (use Paper for that).
  - History:
    - Component 1, studies in depth: 1A–1H (`c100ua0` … `c100uh0`).
    - Component 2: period studies 2A–2D (`c100u10` … `c100u40`) and thematic studies
      2E–2H (`c100u50` … `c100u80`). Component 3 is non-exam assessment.
    - The **Study** filter (`?option=thematic`) keeps one kind of study: British depth,
      non-British depth, period or thematic. Paper then lists that kind's four options.
- **Parts.**
  - Religious Studies: questions "1." with parts (a)–(d): a key concept [2], describe [5],
    explain [8], evaluate [15]. (a) starts at the question's number, so it carries the
    theme. Route B's (a)–(c), and some (d)s, are two questions, (i) and (ii). These stay one
    part, and their marks add up (4, 10, 16, 30). Ids look like `c120u10-jun24-01-a`.
  - History: one question per heading. A question printed under sources or interpretations
    has them cut as its stem (`c100ug0-jun24-04-stem.webp`). The part is the question from
    its own first line, so a one-part question's id ends `-q` (`c100ug0-jun24-04-q`).
    Thematic question 6, on the historic site, has (a) and (b).
  - Answers are written in the question booklet, so a crop runs from a part's first line
    to its last, inside the page frame. It leaves out the answer lines and the margin's
    mark boxes, and a run of answer lines between (i) and (ii) is cut out. Reports are by
    question. `noCalc` is set.
- **Mark schemes.**
  - Religious Studies: a part's crop is its indicative content, then the band descriptors
    it is marked on. Those come from the scheme's front pages, matched by their heading
    ("Question (c)", "Questions 1 (d), 3 (d) and 4 (d) ONLY", "Question 2 (d) LIFE AND
    DEATH"). A part that carries the SPaG marks also gets the SPaG grid. Some schemes print
    the short course's (a) beside the full course's, and both stay in the crop.
  - History: a question's whole block, its bands and then the indicative content.
  - Marks add up on every paper.
- **Topics.** These come from Eduqas's own specifications (`eduqas_gcse/spec_eduqas_gcse.py`).
  `year` is 0.
  - Religious Studies: 95 topics, which are the specification's areas of study.
    - Route A's four themes have three areas each ("Sexual relationships").
    - Christianity and each faith have 9 or 10 areas, beliefs then practices.
    - Route B's four themes have six areas each ("Forms: Painting").
    - Faith sections carry their `option`, so the topic tiles follow the Religion filter.
  - History: 112 topics. Each option's seven key-question areas ("The Black Death") are
    topics, and each thematic study also has "The historic site". Sections carry their
    study's `option`.
  - Long titles are shortened (`SHORT` and `SHORT_HISTORY`). A title shared by sections
    names its section ("The afterlife (Judaism)", "Immigration (USA 1910–29)", `WHOSE` in
    `build_eduqas_gcse.py`). Every slug is under 50 characters, and the build asserts
    under 70.
  - Tagging was done by Claude subagents reading each part against its own section's topics
    (tag.md, "Eduqas GCSE Religious Studies and History"). Every topic has questions.
    History's question 6 parts are always the historic site. Religious Studies' 2024
    reports list what each part tested ("(b) Area of Study: Symbolism; …"), and those
    lists were given to the taggers.
- **Pipeline.** `scripts/question-bank/eduqas_gcse/`, one set of scripts for both subjects
  (`rs` or `history`):
  - `fetch_eduqas_gcse.py` reads the qualification pages' pastpapers and keydocuments tabs.
    It places each file by the code in its name or by the old paper numbers 2018–2020 use
    (`s18-5120-05.pdf` is RS's Islam paper; History's 5101–5104 are 1A–1D, 1E–1H, 2A–2D and
    2E–2H), checked against the cover. Large-print, braille and short-course files are
    skipped.
  - `spec_eduqas_gcse.py`.
  - `cut_eduqas_gcse.py` is self-contained; the shared cutters are untouched.
  - `tag_eduqas_gcse.py`.
  - `build_eduqas_gcse.py`.

  On R2, the papers are under `eduqas/c120*` and `eduqas/c100*` (reports
  `eduqas/c120-er-a-jun24.pdf`, one per series and, for Religious Studies until 2024, per
  route). The crops are under `bank/c120*` and `bank/c100*`.
- **Gaps (as Eduqas publishes them):**
  - Papers:
    - Religious Studies Sikhism, Autumn 2021: no paper or scheme published.
    - History's Autumn 2021 resit: only 1G, 2A, 2E and 2F are published.
    - June 2026 papers aren't up yet (Eduqas waits a year), though the June 2026 reports
      are. They're left out until the papers follow.
  - The Religious Studies short course (5125) is a qualification of its own, and its papers
    are left out. Its questions overlap the full course's.
  - Reports:
    - Religious Studies' 2024 and 2025 reports, and Autumn 2021's, comment by type of
      question ("the 'd' questions"), not question by question. Those parts show no
      comments.
    - Autumn 2020's comments question by question only on Route A Components 1 and 2 and
      Islam; its other sections are short summaries.
    - History's Autumn 2020 report covers only 1B, and Autumn 2021 has none.
    - History's reports from 2019 on comment once for each kind of study ("Q.3" for every
      British depth study). Each option's question shows those comments. June 2018 comments
      option by option.
  - Some sources are photographs or cartoons that Eduqas removed from the public papers
    for copyright ("[A photograph showing …]"). The stem shows the caption where the
    picture was.
  - No sample assessment materials are included, as with the other banks.

```bash
python3 scripts/question-bank/eduqas_gcse/fetch_eduqas_gcse.py rs        # or history
python3 scripts/question-bank/eduqas_gcse/spec_eduqas_gcse.py rs
python3 scripts/question-bank/eduqas_gcse/cut_eduqas_gcse.py rs
python3 scripts/question-bank/eduqas_gcse/tag_eduqas_gcse.py split rs    # tag the batches, then:
python3 scripts/question-bank/eduqas_gcse/tag_eduqas_gcse.py merge rs
python3 scripts/question-bank/eduqas_gcse/build_eduqas_gcse.py rs
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/eduqas-gcse-rs --pdf-prefix=eduqas/
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

## Edexcel GCSE Computer Science

Added 30 October 2026, after a student asked: `/question-bank/edexcel-gcse-computer-science`
(Pearson Edexcel GCSE (9-1) Computer Science, 1CP2), on the GCSE shelf, and its past paper
library page `/past-papers/gcse-computer-science/edexcel`. Every file is Pearson's own, from
qualifications.pearson.com. Whole papers and code files are on R2 under the library's names
(`edexcel/EDX-1CP2-01-QP-JUN24.pdf`, `edexcel/EDX-1CP2-02-DATA-JUN24.zip`), the crops under
`bank/1cp21*` and `bank/1cp22*`.

- **210 parts** from 10 papers: Paper 1 (Principles of Computer Science) and Paper 2
  (Application of Computational Thinking) for June 2022 to June 2025 and the sample
  assessment materials. Every paper adds up to its 75 marks, every part has its own scheme
  crop, the 18 multiple-choice parts show their answer letter, and every question from a
  live series has the examiner's comments on it.
- **Paper 2 is sat on screen, in Python.** Each of its six questions ("Open file Q03.py",
  amend or write the program) is one whole question here, with its scheme: the marking
  points, the levels grids and Pearson's model program (printed as pictures). Beside each
  question is "The code files (zip)", the sitting's Q01.py to Q06.py and data files. Pearson
  keeps June 2025's code files for teachers only, so those questions have none; the bank
  page says so.
- **Topics:** the specification's 66 numbered points (`2.1.3` Converting denary and binary,
  `4.1.5` Network speed calculations, `6.4.2` Reading and writing files), with short titles
  written for them, under its 20 headings (`1.2 Algorithms`, `6.4 Input and output`).
  Paper 1 is tagged to Topics 1 to 5, Paper 2 to Topic 6.
- **Library:** both papers, every sitting, with question paper, mark scheme and examiner's
  report, the specimen (Pearson's sample assessment book for each paper, split into its
  question paper and mark scheme), and Paper 2's code files under "More" (June 2022 to
  2024 and the specimen). The library's `data` kind and its "Code files" link are new.
- **Pipeline:** `scripts/question-bank/edexcel_cs/`: `fetch_cs.py` (Pearson's search index,
  as `boards/edexcel.py`), `spec_cs.py`, `cut_cs.py` (cut_pearson.py as a library; Paper 2's
  schemes are cut by their pages, its reports' "Q01 – …" headings read), `tag_cs.py` (tag.md's
  Edexcel GCSE Computer Science section) and `build_cs.py`. The library's
  `scripts/past-papers/boards/edexcel_cs.py` runs the same fetch. Two marks the cutter
  misreads are set in `scripts/question-bank/labels/1cp21-jun22.json` and `1cp21-jun25.json`.
- **Gaps:** June 2026 and June 2025's code files are for teachers only on Pearson's site.
  1CP2 was first sat in June 2022; there is no November series.

```bash
python3 scripts/question-bank/edexcel_cs/fetch_cs.py
python3 scripts/question-bank/edexcel_cs/spec_cs.py
python3 scripts/question-bank/edexcel_cs/cut_cs.py
python3 scripts/question-bank/edexcel_cs/tag_cs.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_cs/tag_cs.py merge
python3 scripts/question-bank/edexcel_cs/build_cs.py
python3 scripts/past-papers/boards/edexcel_cs.py && python3 scripts/past-papers/build.py
python3 scripts/past-papers/upload.py edexcel-cs
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-cs --crops-only --checksum
```
