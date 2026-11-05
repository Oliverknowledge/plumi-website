# Eduqas A-Level English Literature

Added 1 November 2026: `/question-bank/eduqas-a-level-english-literature`, every question from
Eduqas's A Level (A720QS) Components 1 (Poetry), 2 (Drama) and 3 (Unseen Texts), June 2017 to June
2025 with the autumn 2020 and 2021 sittings, from eduqas.co.uk. That is 400 questions and parts
from 27 papers, every one with its mark scheme notes and that section's full assessment grid, 346
with the examiner's comments. Scripts in `scripts/question-bank/eduqas_english_lit/`: the fetch runs
`eduqas/fetch_eduqas.py` on this qualification, the cutter borrows `eduqas_rs/cut_eduqas_rs.py`'s
crop helpers, and the build is the Edexcel builder's `build()`.

- **Topics are the set texts** (`texts.py`, the specification's list): Component 1 Section A's
  pre-1900 poetry texts, Section B's pairs of poets, Component 2 Section A's Shakespeare plays and
  Section B's pairs of plays (a pair is one topic, as students study it), and Component 3's two
  prose periods and unseen poetry. Blake replaced Keats, and Yeats and Abse replaced Lawrence and
  Clarke, from 2022 (June 2022 set both): the old texts say "to 2022", the new "from 2022".
- **Parts and stems.** A Section A question is two parts, both answered (`a720u20-jun24-01-i`,
  label "1(i)"); their stem is the text's heading and, in Component 2, the printed extract
  (`a720u20-jun24-01-stem.webp`). A Section B question's stem is its pair's headings and prescribed
  sections; a one-part question's id ends "-q" so it has a stem of its own. Component 3's passage,
  supporting extracts and poems stay in the question's crop, which runs over three pages.
- **Either/or.** Every question in a section after its first carries `or`: the papers add up to
  120, 120 and 80.
- **Mark schemes** are matched to questions by the question each one reprints, as a few misnumber:
  June 2018 Poetry heads question 15 "Q14", June 2018 Drama question 8 "Q9", Unseen June 2017 and
  2018 question 2 "Q1" and June 2018 question 4 "Q3". The grids (part (i), part (ii), Section B;
  Component 3 Section A and B) sit after each section's notes, over one or two landscape pages.
- **Reports** comment by question, by part and text ("Section A (i)", "Chaucer") or by section,
  and each question gets the most particular comments there are. Autumn 2021 has no report;
  Eduqas's headings misspell two chapters ("COMONENT 2", "COMPONENT: UNSEEN TEXTS").
- **Left out:** the AS (B720), June 2026 (not published yet), Component 4 (coursework).
- **Whole papers** are uploaded as `eduqas/a720u*`; crops under `bank/a720u*`.
