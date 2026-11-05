# AQA A-Level Maths

`aqa_maths/tag_maths.py split` writes batches for AQA A-Level Mathematics 7357 to
`.work/aqa-maths/tag/`, and `merge` collects them. The brief is the one in `tag.md`,
with these differences:

- Maths is tagged a whole question at a time, as the other maths banks are: one to
  three codes, the main one first (the topic most of the marks are for).
- `maths-topics.txt` lists one topic per line: `code | section | title — the
  specification's statements (B1, B2, ...)`. Codes are the specification's letters,
  `A` (Proof) to `S` (Moments); choose from these, never a statement like `B3`.
- Each line has a `paper`: Paper 1 is all pure (A-J); Papers 2 and 3 are pure in
  Section A, then Mechanics (P-S) in Paper 2's Section B and Statistics (K-O) in
  Paper 3's. A Section B question takes a pure code only when some of its marks are
  for pure maths (solving the differential equation in a kinematics question takes
  `H` after `Q`).
