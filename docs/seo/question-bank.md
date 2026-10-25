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

- AQA no longer publishes Biology Paper 1 for 2017–2019 or Paper 3 for June 2018,
  so they aren't here.
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

## OCR and OCR MEI

Added 25 October 2026, after the bank's video went viral and students asked for OCR:

| Bank | Specifications | Unit |
| --- | --- | --- |
| `/question-bank/ocr-a-level-biology-a` | H420, AS H020 | part |
| `/question-bank/ocr-a-level-chemistry-a` | H432, AS H032 | part |
| `/question-bank/ocr-a-level-physics-a` | H556, AS H156 | part |
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

Gaps: OCR's November 2020 Biology A AS Paper 2 mark scheme link serves another
paper's scheme, so those 30 parts link no scheme. Two November 2020 Biology A papers
are scans; only the parts OCR's text reading and their scheme confirm are in.

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
it follows. IGCSE (0580, 0606, 0610, 0620, 0625 and the 9-1 syllabuses) is public on
the same terms and cuts cleanly (sciences ~1,500 parts, every one with its scheme), but
needs an "IGCSE" level in the bank, its own syllabus topics and tagging: not yet.

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
