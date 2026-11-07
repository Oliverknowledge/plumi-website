# Maths booklets

`/maths-booklets` and `/maths-booklets/<group>`: 250 MadAsMaths topic booklets, from the first steps of algebra
to beyond A-Level, with 11,719 questions between them. Each question has its difficulty in stars, its answer and
a worked solution. 15 booklets also come as questions only. Added 6 November 2026.

## Permission and credit

The founder of MadAsMaths gave permission to host the booklets here: copies on our own storage, free and open,
with no sign-up. The pages say "These booklets are from MadAsMaths" and link to madasmaths.com, and name nobody,
as asked. The booklets themselves are unchanged, so their own pages still carry their author's line.

## Where they came from

A Google Drive folder, "Madas Maths booklets", shared by link (`1NZIl94mXVGrC3bBCKWDPLa6lhfgDh8AA`). It is someone's
copy of the site's downloads from October 2023, not MadAsMaths' own, so a booklet revised since then is the older
version here. Its 274 PDFs are listed in `scripts/booklets/drive-files.json`. Left out:

- two repeat downloads of `circle_coordinate_geometry_exam_questions.pdf` (`… (3).pdf`, `… (4).pdf`);
- five "Coming soon" pages: calculus of variations, differential geometry, tensors, z-transforms, and groups and
  relations;
- the questions-only versions, which aren't booklets of their own but are paired with theirs ("Questions only").
  `integration_definite_megamix` and `integration_indefinite_megamix` also have a closer-set
  `_student_version_condense`, which isn't used.

## How it's built

```bash
python3 scripts/booklets/fetch.py      # the PDFs, from Drive, into scripts/booklets/.work/pdf (about 2.2 GB)
python3 scripts/booklets/build.py      # src/content/booklets.json, previews, and the files for R2
python3 scripts/booklets/upload.py --verify
```

- **Groups** follow the Drive folder's: Elementary, Basic, Standard, Further and Advanced topics, Mechanics and
  Statistics. The pages call them by who they're for ("Year 13 pure maths"), in `groupCopy` in
  `src/content/booklets.ts`, with MadAsMaths' own name as the kicker.
- **Titles** come from the file names, with the misspellings fixed and the clumsy ones rewritten (`TITLES` in
  `build.py`). "Exam questions" and "Practice" become a tag, as do Mechanics' module codes (M1 to M6).
- **Questions** are counted from "Question N" headings, or "1.", "2.", … where a booklet numbers them that way
  (the integration mixes, trigonometric identities). A "Question N" can hold several parts, so "Integration by
  parts" has 3 questions and 30 integrals. Stars are read where the booklet prints them; about 90 don't.
- **Previews** are the first question, cut from just above its first line (past the "Created by" line every page
  repeats) to a 4:3 frame across the text, 640px wide, as WebP.
- **Files** are on R2 under `booklets/madasmaths/<group>/`: `<slug>.pdf`, `<slug>-questions.pdf` and `<slug>-preview.webp`,
  served inline and cached for a year as immutable. A changed booklet needs a new slug.

## The pages

Blue where the rest of the site is orange (founder, 6 November 2026). Both pages list the booklets through
`BookletBrowser`: a search box, chips for the group or shelf, exam questions or practice, Mechanics' modules, "has
questions only" and difficulty, and cards or a compact list (remembered per browser; the hub starts on the list, a
group's page on cards). Opening a booklet on a wide screen shows it in a viewer on the page, the browser's own PDF
viewer in a dialog; on a phone it opens in a new tab, as an embedded PDF there shows only its first page.

`booklet_opened` (analytics) reports each booklet opened, with its group and which file; `booklet_searched` a search
that settled, with how many it found.

## In the question bank: "Add MadAsMaths questions"

A bank can mix MadAsMaths questions in with its past papers', on each topic, behind a switch that's off by default
(`?madas=1`). Pilot, 6 November 2026: Edexcel A-Level Maths only, 6,479 questions (re-cut 7 November).

```bash
python3 scripts/booklets/cut.py                  # every A-Level booklet into single questions (about 5 minutes)
python3 scripts/booklets/check.py --n=16         # sheets of question and answers side by side: read them
python3 scripts/booklets/tag.py split            # batches of questions not yet tagged; each is tagged by a reader into batch-NN.tags.json
python3 scripts/booklets/tag.py merge
python3 scripts/question-bank/upload_data.py --pull <bank slug>   # the bank's other data, which upload_data rewrites the meta from
python3 scripts/booklets/bank.py <bank slug>     # the bank's madas.json, and its crops in .work/r2/bank/m<N>/
python3 scripts/booklets/upload.py --verify      # the crops (wait for it before running bank.py again: bank.py rewrites that folder)
python3 scripts/question-bank/upload_data.py <bank slug> --verify
```

- **Cutting** (`cut.py`): the Basic, Standard, Further, Mechanics and Statistics booklets, 9,956 questions (Elementary
  and Advanced are left as booklets). A MadAsMaths page sets each question out the same way: "Question 4 (**+)", the
  question, its answers (boxed, in a row at the right, sometimes over several rows), then the worked solution, scans of
  handwriting set small on the right. The question's crop stops above its answers, so the card doesn't give them away;
  its answers crop is the answers with the solution. What the cutter knows, each learnt from a crop that was wrong:
  - **The solution is every picture after the answers** (below the answer row, or on a page after it before the next
    question), whatever its shape: a whole scanned page clipped to this question's part, or landscape strips stacked
    one under another, which are joined. A picture above the answers is the question's own figure. (The first cut
    took only portrait scans, and 2,504 live questions had answers with no working.)
  - **The answers** are the last row of boxes on the right with nothing of the question beside them, with every row
    above it they run on to, up to the question's last words. A box with a part's words beside it on its line is that
    part's answer ("b) ∫ … dx  [21]"): it's painted out of the question and its line is shown with the answers. In a
    question whose answers aren't at its end (a note follows them), any box on the right with real words in it is an
    answer. Text inside a box (the first, "empty" box holds MadAsMaths' code, "SPX-N"), commas, one-letter diagram
    labels and "[solution overleaf]" aren't question text; a table's cells (boxes sharing sides) stay in the question.
  - **Headings** are "Question N (stars)", including three printed without their number (each between two numbered
    questions: they're "16b") and one without its space ("Question6"). Ids count the numbered headings, so they hold
    between cuts.
  - 91 are left out, with neither answers nor a solution: drill sheets that print each answer beside its item
    ("Differentiation practice", "Integration basics").
  - Read the sheets (`check.py`) before a bank takes a cut: numbers have passed cuts that put answers on the question.
- **Crops on R2** are under a version folder, `bank/m<N>/<id>-qp.webp` and `-ms.webp` (`MADAS_VERSION` in `bank.py` and
  in `questionBank.ts`, kept in step; the first cut was `bank/<id>-…`). A re-cut takes a new folder: it goes up beside
  the crops the live site uses and changes nothing until the deploy that reads it, so no `cropVersion` and no squashed
  crops in between.
- **Tagging** (`tag.py`, `topics.json`): once, to a shared list of 53 topics (indices and surds, integration methods,
  projectiles, Poisson, ...), not to any board's. 7,101 questions (Year 12 and 13 pure, Statistics, and the M1–M2
  Mechanics booklets) were tagged on 6 November 2026 by Claude subagents, 600 a batch, following the brief in
  `tag.py`; 800 have two topics. The 8 the re-cut separated were tagged by hand on 7 November. Some readers sorted long repetitive runs by keyword, then read the odd ones, so
  this is a first pass. The tags are committed, in `scripts/booklets/tags.json`; corrections go in
  `.work/tag/overrides.json`, then `tag.py merge`. Further Maths and M3–M6 aren't tagged yet.
- **A bank** takes them through its map in `topics.json`, from each shared topic to one of its own, or to null where
  its specification doesn't have it. A question goes in only if every topic it needs is in the specification (628
  aren't, for Edexcel A-Level Maths: Poisson, momentum, further statistics...). Another bank is another map and
  `bank.py`, not another tagging pass.
- **On the page**: the rows are the bank's own shape (`madas.json` among the bank's data, crops under `bank/m<N>/`),
  so marking, saving, sets and PDFs work on them unchanged. Their "paper" is the booklet and their "series" MADAS
  (`madasSubject` in `questionBank.ts` names them for the rows), so the paper, year and Year 12/13 filters leave them
  out. Sorted newest or oldest first, they're sprinkled in, one after every two past-paper questions; by topic, marks
  or mixed, they sort with the rest. The scheme button, the zoom viewer and a downloaded set's pages say "Answers".
  `bank_madas` reports the switch.
