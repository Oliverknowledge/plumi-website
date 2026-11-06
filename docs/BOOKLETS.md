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
