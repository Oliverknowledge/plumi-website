# Edexcel Economics A

`edexcel_economics/tag_economics.py split` writes batches of Pearson Edexcel A-Level
(9EC0) and AS (8EC0) Economics A parts to `.work/edexcel-economics/tag/`, and `merge`
collects them. The brief is the one in `tag.md`, with these differences:

- `economics-topics.txt` lists the specification's sub-topics: `code | topic | title
  [AS] or [A-Level only] — what the specification says under it`. Codes have three
  numbers (`1.2.3`, `3.4.4`); choose from these, never a topic like `3.4`.
- Each line has its `paper` ("AS 1", "A-Level 3"). AS papers only test [AS] topics
  (themes 1 and 2). A-Level Paper 1 is mostly themes 1 and 3, Paper 2 themes 2 and 4,
  and Paper 3 can test anything.
- The `setup` is often the start of the extracts the question is set on; judge by
  what the question asks and its scheme, not by the extract's subject (a question on
  the gas industry's price elasticity is `1.2.3`, not an energy topic).
- Multiple-choice questions: `question` holds the stem and options A–D; tag by the
  concept tested (a PED calculation is `1.2.3`).
- Essays and the 15–25 mark questions often span several sub-topics: give the main
  one first and a second only when the scheme's indicative content genuinely needs it
  (an essay on the effects of a minimum wage: `3.6.2` then `3.5.3`).
- Common confusions: externalities `1.3.2` vs government intervention `1.4.1` (a tax
  or regulation to correct an externality is `1.4.1` unless the question is about the
  externality itself); balance of payments in theme 2 (`2.1.4`) for AS and theme 4
  (`4.1.7`) for A-Level questions on causes and correction of imbalances; demand-side
  policy `2.6.2` vs central banks `4.4.3` (the Bank of England's tools and role are
  `4.4.3` on A-Level papers when the question is about the central bank itself).
