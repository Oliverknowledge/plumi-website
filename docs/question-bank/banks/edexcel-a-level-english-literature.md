# Edexcel A-Level English Literature

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
