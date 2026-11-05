# AQA Philosophy

`aqa_philosophy/tag_philosophy.py split` writes the AQA A-Level Philosophy (7172)
questions to `.work/aqa-philosophy/tag/` (one batch: 120 questions), and `merge` collects
them. The brief is the one in `tag.md`, with these differences:

- `philosophy-topics.txt` lists one topic per line: `code | area | title — what the
  specification says under it`. Codes have three or four numbers (`3.1.4`, `3.3.2.1`);
  choose from these, never an area like `3.3`.
- Each line is a whole question with its `area` (questions 01–05 are the paper's first
  area, 06–10 its second: Paper 1 Epistemology then Moral philosophy, Paper 2 Metaphysics
  of God then Metaphysics of mind), its `marks`, its words and the start of its scheme's
  indicative content. Tag within the line's area.
- Tag the theory or argument the question is about: "Explain Hume's design argument" is
  `3.3.2.2`; a question on a criticism of a theory is that theory's topic ("the
  asymmetry of self-knowledge is a problem for behaviourism" is `3.4.3.1`). Interactionist
  and epiphenomenalist dualism and their issues (the problem of other minds, interaction,
  self-knowledge, evolution) are `3.4.2.3` Issues facing dualism.
- Terms from the course's opening (analytic/synthetic, a priori/a posteriori,
  necessary/contingent) are `3.1.3.2`, the intuition and deduction thesis, as is Hume's
  Fork; necessary and sufficient conditions are `3.1.1`. Ayer's verification principle on
  Paper 1 is moral anti-realism (`3.2.3.2`), on Paper 2 religious language (`3.3.3`).
  Applying a theory to stealing, simulated killing, eating animals or lying is `3.2.2`
  then the theory's code.
- An essay weighing two theories against each other in equal measure (moral realism
  against anti-realism, substance against property dualism) gets both; otherwise one.
