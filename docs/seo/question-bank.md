# The question bank

`/question-bank`, one bank per subject, and a page per spec topic. Built 23 October 2026.

This file has what every bank shares. Each bank's own notes (series, counts, gaps, how it was built) are in
`docs/question-bank/banks/`: a new bank writes `<slug>.md` there and doesn't edit this file. Find a bank's notes with
`grep -rl <slug> docs/question-bank/banks`. To add a bank, follow `docs/question-bank/add-a-bank.md`.

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
- **Files we serve:** Cloudflare R2, at `NEXT_PUBLIC_PAPERS_URL` (moving its address:
  `docs/question-bank-domain.md`). Whole papers under
  `aqa/`, question crops under `bank/`. In development they're served from
  `public/papers-local` (a symlink into the gitignored work folder).
- **Data the site reads:** `src/content/questionBank/*.json` (topics, papers,
  series, the newest 20 parts; built into the pages) and the bank's data,
  `{parts,text,reports}.json` (the list, search text, examiner's reports), on R2 under
  `bank-data/<subject>/` (see "Bank data on R2" below): fetched by the browser, and
  parts.json by the build for the topic pages.

## Bank data on R2 (3 November 2026)

The builders still write a bank's data to `public/question-bank/<slug>/` (parts, text,
reports, and practicals, year13, tiers and `solutions/` where the bank has them), but git
ignores that folder: 216 MB of JSON that every build cloned and deployed, and that every
bank PR added to. The site reads the files from R2 instead, named by their content hash:

- `bank-data/<slug>/parts.<hash>.json` (and text, reports, ...), and
  `bank-data/<slug>/solutions.<hash>/<id>.json` for the worked solutions;
- stored gzipped (R2's public URL doesn't compress) and cached for a year as immutable:
  a new cut is a new name, and an older deployment keeps finding its own files;
- the hashes sit in the bank's meta, `src/content/questionBank/<slug>.json`, as
  `"data": {"parts": "…", …}`, which is what gets committed. `bankDataUrl` and
  `bankSolutionUrl` build the URLs; `src/lib/bankParts.ts` reads parts.json for the topic
  pages (at build) and the partner embed (on demand).

**After building or re-cutting a bank** (and after any script that rewrites its data or meta:
tiers.py, practicals.py merge, maths_years.py, the solutions):

```bash
python3 scripts/question-bank/upload_data.py <slug> [<slug> ...]   # --dry-run first to see what changes
```

It uploads only what is new, writes the hashes into the meta, and stops if a file the bank
already has on R2 (practicals, year13, tiers) is missing on disk. Commit the meta; never
`git add -f` anything under `public/question-bank/`. A builder that rewrites the meta drops
`data`, and `next build` then stops at that bank's topic pages with the command to run.

**In a fresh worktree** the folder is empty. Before re-cutting or rebuilding an existing bank,
or running a script over every bank (tiers.py, practicals.py, ms_fallback.py,
solutions/check_solutions.py), pull what is on R2 (no keys needed):

```bash
python3 scripts/question-bank/upload_data.py --pull <slug>   # or --pull --all
```

The old URLs, `/question-bank/<slug>/<file>.json`, redirect (307) to the bank's current file on R2
(`bankDataRedirects` in next.config.ts), because the Discord bot's question of the day
(`plumibot/bank.py`) still reads them.

Previewing a bank locally needs its data uploaded first, as its crops do, and
`NEXT_PUBLIC_PAPERS_URL` set: the pages fetch from R2 in development too. R2's CORS
allows any origin for GET and HEAD (since 4 November 2026).

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
- Chemistry goes back to 2010 with AQA's old specification (2420): units CHEM1 and CHEM2
  (AS) and CHEM4 and CHEM5 (A2), January 2010 to June 2016, as papers "CHEM1 (old spec)"
  and so on. A student's teacher sets tests from them. AQA publishes none of these now
  (every file store address answers "not found" and its past paper search starts at June
  2016), so the founder chose PMT's copies (2 November 2026), again **for the question
  bank only**, with no examiners' reports. 44 sets, 2,069 parts, every paper adding up to
  its 70 or 100 marks; 2,045 are in the bank, tagged to 7405's topics, and 24 whose marks
  rest on content 7405 dropped (extracting metals, a magnetic-sector mass spectrometer's
  deflection) are left out. CHEM3 and CHEM6 were the practical ISA/EMPA units. Scripts in
  `scripts/question-bank/aqa_chem_legacy/`: `fetch_pmt.py`, `cut_legacy.py` (the old
  "2 (b) (ii)" labels and the schemes' four table layouts), `tag_legacy.py` (tag.md's
  "legacy units" brief), then `build_legacy.py`, which adds the legacy rows to the bank
  `build_bank.py` wrote without rebuilding it, and prints the per-paper table.
- Physics also goes back to 2010 with the legacy specification, Physics A (2450): PHYA1,
  PHYA2, PHYA4 (Section A, the objective test, and Section B) and PHYA5 (Section A and the
  four options), January and June 2010 to June 2016, 1,786 parts as extra papers named
  "PHYA1 (old spec)" and so on, tagged to 7408's topics. A teacher builds tests from them.
  AQA publishes none of it any more (its file store answers "not found" and its search
  starts at June 2016), so the founder chose PMT's copies (2 November 2026), **for the
  question bank only**, with no examiners' reports; PHYA3 (the practical ISA/EMPA) is left
  out. Scripts in `scripts/question-bank/aqa_physics_legacy/`: `fetch_pmt.py`,
  `cut_legacy.py` (the old "1 (a) (i)" labels and three scheme layouts, PHYA5 schemes to
  2013 printing the core and the option in one file), `check_legacy.py`, `tag_legacy.py`
  and `build_legacy.py`, which merges the rows into the built bank without touching the
  7407/7408 rows or `files.json`.
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

Then `python3 scripts/question-bank/upload_data.py --all` (the bank data, see "Bank data on R2"),
build, check a subject and a topic page, commit the meta JSON, and resubmit the
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

## Answer boxes, options and "[n marks]" (AQA), fixed 4 November 2026

A student-facing report: AQA A-Level Spanish June 2025 "01.1 Clara" read as cut off. It was two faults. Its two answer boxes
stand taller than the label, so `cut.py`'s crop (from 6pt above the label) took their tops off and left them on the end of the
setup above; and the options the boxes refer to sit in that setup, which was folded. Every live crop was then measured
(293,889 images: question, setup and scheme; none missing, none blank), which found the same fault and others:

- `cut.label_top`: a part starts at the top of its line: the highest text or drawing that starts above the label and runs past
  its top. Not a "[2 marks]" (the part before's can sit beside the label), a rule over 70pt tall (the frame) or a box over 300pt
  wide (a section heading); each of those did real damage on a first attempt.
- `cut.frame`: a "[35 marks]" ending just past 537pt lost its bracket, and on a specimen, whose page sits further right, "[1 mark"
  lost more. The frame now reaches the marks, but stops short of the frame's border (538.6pt), or trailing space can't be trimmed.
- A re-cut also corrected crops older than the current `cut.py`: tick-box options that had moved to the top of the next part
  (Biology 74023 June 2025 04.2's, now under its own question), and the next question's title on the end of a GCSE languages crop.
- OCR Biology A Paper 2, November 2020: 12 crops on R2 were from an older cut than their rows (the rows said 395 tall, the picture
  was 1104), so they drew squashed, with question 4's image on the end of question 3. Its current crops, already in the work
  folder, went up (`cropVersion` 5, `CROP_VERSION_OF` in `ocr/build_ocr.py`).

`recut_compare.py` decides what goes live: it sets each new crop against the live one and takes only the real changes, holding back
one that came out narrower (`cut_aqa_bio_pmt.py`'s AS June 2016 sets need their width), newly sliced, or whose marks differ from its row.
Every re-cut's largest changes were read by eye. Banks re-cut: AQA A-Level French, Spanish and German, GCSE French, Spanish, Bengali
and German, and A-Level Biology, Chemistry and Physics (their 2017-on papers).

**Not re-cut then:** the banks below, re-cut on 5 November.

## The rest of the audit's banks (AQA, Edexcel and OCR GCSE Maths, OCR sciences, WJEC, Eduqas), fixed 5 November 2026

Each fault was read by eye before anything changed. What was wrong, by cutter:

- **Maths** (`cut_maths.py`, `cut_pearson.py --whole`): a question's top was cut through a tall power, a fraction or a matrix. A numerator or a matrix's top rows end above the
  label, so `label_top`, which only counted what runs past the label, missed them, and Edexcel's November 2019 papers draw theirs as shapes. A short piece mid-line that the cut goes
  through now counts, then the row just over it. `cut.label_top` rises only as far as there is ink: some fonts' boxes reach 20pt above their glyphs, which left a band of white. In `cut_pearson.py`
  this is for whole questions only: over a part's "(a)", the same rule climbed past the question's number into "Section B" and lost the part its opening words.
- **AQA specimens** (`cut.frame`): they draw no frame and print no margin note, and their lines run to 554pt, so "[1 mark" and half a sentence were cut at 537pt. 173 of the 606 GCSE science specimen rows had
  no marks at all; `apply` now fills marks only where a row had none. With the marks readable, `setups.py` moved their setups to the right part, the biggest changes here. Their page number and the rule under it stay out.
- **WJEC** (`cut_wjec.py`): a line runs to the frame's border (541pt) and the crop stopped 3pt short, which took the end off its last letter or comma on 2,900 lines across all the sciences, maths, business and criminology.
- **OCR** (`Doc.frame`): the crop stopped 4pt above "© OCR", and an answer line printed just above it lost the feet of its "[1]". It reaches further only on a page where such a line crosses that cut: any lower everywhere shows the top of "Turn over" (1,300 crops on the first try, stopped by the "sliced" gate).
- **OCR, Eduqas** (`label_top`): what the cut goes through and ends at the label stays whole on the part above: a "[4]", a table's last rule, not a sliver of "20" over "(a)". Only in the margins or for a long line or rule: mid-line, that took the tip off a drawn arrow.
- **Legacy Chemistry** (`aqa_chem_legacy/cut_legacy.py`): a power on the label's line ("mol dm⁻³") counted as a line of the part above, so the crop started below it.
- **AQA A-Level Religious Studies, GCSE sciences, Combined Science, Computer Science:** `cut.frame`'s fix for "[25 marks]" (4 November), which these hadn't been cut with.

`recut_compare.py --base=<work-dir>` compares with the same cutter's run from before the fix: a crop it left byte for byte as it was is "same". Without it A-Level Maths showed 317 changes for 54 questions, because a bank cut with another
PyMuPDF renders a pixel or two differently everywhere. A second run's baseline for banks last cut before 4 November needs `cut.py` from before that day.

- **Eduqas sciences** (`cut_eduqas.content_bottom`): this trims a part's empty answer space by finding where its content ends, and it missed two things. Pictures, so a micrograph was cut in half. And zero-area rules, which `Rect.intersects` says no to, so a table lost its last rule and a "plot a graph" part lost its whole grid (83px live, 1,546 now). A page's foot now keeps a line the margin cuts through and a graph's axis label below it, but not an answer's "n =". `get_text`'s clip also hands back pictures below the rect, with their box upside down: test the overlap. The `cut_wjec` banks don't share this code.

6,668 crops change in 33 banks; 66 are held back, listed by state in the PR. Left alone: AQA legacy Physics (its `clear_cut` already handles this; the flags read were the frame's lines), Eduqas Religious Studies (a sliver of a box over 24 crops in October 2020, no words lost, and clearing it only half worked), Edexcel IAL Maths and AQA Law (page borders only).

**Still to do:** `cut_pearson.py`'s footer and sliver rules will change other banks on their next re-cut (OCR Computer Science, Geography and others that it cuts weren't re-cut). Scheme crops were measured, not read: their table rules set the measure off.

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

## Year 12 and Year 13 (A-Level Maths and Further Maths)

A student asked for it (27 October 2026): "the maths questions are kinda annoying bc it
includes yr13 stuff as a year 12". The sciences split by topic (each topic's `year`), but
maths topics (Algebra, Differentiation, Integration…) run through both years, so maths
splits by question: the A-Level Maths banks' "Year" filter shows Year 12 (questions that
need only the AS content) or Year 13 (questions that need second-year content).

- **Data:** `public/question-bank/<slug>/year13.json`, the ids of the Year 13 questions,
  beside the bank's data so a rebuild leaves it alone. `bankHasYears` turns the filter
  on for any bank with that file's hash in its meta's `data`, so a bank needs no code to
  get it; the URL keeps it as `?yr=12` or `?yr=13`.
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
- **Further Maths** (Edexcel, OCR, OCR MEI, AQA) splits the same way: AS Further Maths papers
  are Year 12, and each A-Level paper question was read against that board's AS Further
  Maths specification (`maths_years.py split-further` / `merge-further`, brief in
  `tag.md`). Cambridge's Further Maths (9231) has no AS, so it has no switch.

## Year 12 and Year 13 (A-Level Biology, 5 November 2026)

The same "School year" switch (Both years · Year 12 · Year 13) on the eight A-Level Biology banks
(AQA, Edexcel A and B, OCR A and B, Eduqas, WJEC, Cambridge). Unlike maths, Biology's topics
already sit in a year (each topic's `year` in the meta: 1 AS, 2 second year, 3 Eduqas's options), so
`scripts/question-bank/biology_years.py` decides by rule rather than by reading every question:

- a part on an AS paper is Year 12;
- a part on a full A-Level paper is Year 13 if any of its topics is second-year content, else Year 12;
- a short list of parts whose tag was wrong, found by reading, is overridden in `HAND_READ` (10 AQA
  parts tagged 3.7.3 that only ask natural selection, which AQA examines at AS; 13 WJEC A2-unit parts
  tagged with AS topics that ask ATP, pigments, the electron transport chain, the kidney, the options).

The topic years match each board's AS content: every AS topic is drawn on by that board's AS papers, and
no second-year topic is, bar 21 AQA parts (3.5.1, 3.5.2, 3.7.2, 3.7.3, 3.7.4) on AS papers, which stay Year 12.
`bankHasYears` is on for any A-Level Biology bank; the data is `year13.json` as for maths. After a new
series: `biology_years.py`, then `upload_data.py <slug>`.

Known edges: AQA Paper 3's 25-mark essays go by their tags (an essay titled on a first-year topic is Year
12 although a full-marks answer may draw on the whole specification); Cambridge Paper 5 (planning and
evaluation) goes by the topic its experiment is on.

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
