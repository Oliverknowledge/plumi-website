# Eduqas GCSE Religious Studies and History

Banks: `eduqas-gcse-religious-studies`, `eduqas-gcse-history`

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
