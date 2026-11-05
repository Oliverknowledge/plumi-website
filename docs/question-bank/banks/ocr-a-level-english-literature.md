# OCR A-Level English Literature

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
