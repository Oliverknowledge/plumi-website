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
(`?madas=1`). Pilot, 6 November 2026: Edexcel A-Level Maths only, 6,477 questions.

```bash
python3 scripts/booklets/cut.py                  # every A-Level booklet into single questions (about 5 minutes)
python3 scripts/booklets/tag.py split            # batches of questions to tag; each is tagged by a reader into batch-NN.tags.json
python3 scripts/booklets/tag.py merge
python3 scripts/booklets/bank.py <bank slug>     # the bank's madas.json and the crops it needs
python3 scripts/question-bank/upload_r2.py scripts/booklets/.work/bank-upload --crops-only
python3 scripts/question-bank/upload_data.py --pull <bank slug>   # the bank's other data, which upload_data rewrites the meta from
python3 scripts/question-bank/upload_data.py <bank slug> --verify
```

- **Cutting** (`cut.py`): the Basic, Standard, Further, Mechanics and Statistics booklets, 9,946 questions (Elementary
  and Advanced are left as booklets). A MadAsMaths page sets each question out the same way: "Question 4 (**+)", the
  question, a row of boxed answers, then the worked solution, a scanned handwritten page set small beside it. The
  question's crop stops above its answers, so the card doesn't give them away; its scheme crop is the answers with
  the solution. A scan is a whole page of working for several questions, clipped in the PDF to this one's, so the
  shown part is what's cut, never the image. 97 are left out, with neither answers nor a solution: the drill sheets
  ("Differentiation practice", "Integration basics") write each answer in beside its item. Read the sheets of
  both crops side by side (`check.py`) before a bank takes them: numbers have passed cuts that put answers on the question.
- **Tagging** (`tag.py`, `topics.json`): once, to a shared list of 53 topics (indices and surds, integration methods,
  projectiles, Poisson, ...), not to any board's. 7,101 questions (Year 12 and 13 pure, Statistics, and the M1–M2
  Mechanics booklets) were tagged on 6 November 2026 by Claude subagents, 600 a batch, following the brief in
  `tag.py`; 800 have two topics. Some readers sorted long repetitive runs by keyword, then read the odd ones, so
  this is a first pass. The tags are committed, in `scripts/booklets/tags.json`; corrections go in
  `.work/tag/overrides.json`, then `tag.py merge`. Further Maths and M3–M6 aren't tagged yet.
- **A bank** takes them through its map in `topics.json`, from each shared topic to one of its own, or to null where
  its specification doesn't have it. A question goes in only if every topic it needs is in the specification (624
  aren't, for Edexcel A-Level Maths: Poisson, momentum, further statistics...). Another bank is another map and
  `bank.py`, not another tagging pass.
- **On the page**: the rows are the bank's own shape (`madas.json` among the bank's data, crops under `bank/madas-*`),
  so marking, saving, sets and PDFs work on them unchanged. Their "paper" is the booklet and their "series" MADAS
  (`madasSubject` in `questionBank.ts` names them for the rows), so the paper, year and Year 12/13 filters leave them
  out. Sorted newest or oldest first, they're sprinkled in, one after every two past-paper questions; by topic, marks
  or mixed, they sort with the rest. The scheme button reads "Answers". `bank_madas` reports the switch.
