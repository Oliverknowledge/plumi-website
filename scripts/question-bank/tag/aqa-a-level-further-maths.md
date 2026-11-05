# AQA A-Level Further Maths

`aqa_further_maths/tag_further_maths.py split` writes batches for AQA A-Level (7367)
and AS (7366) Further Mathematics to `.work/aqa-further-maths/tag/`, and `merge` collects
them. The brief is AQA A-Level Maths's, with these differences:

- Codes are the specification's: `A` (Proof) to `J` (Numerical methods) for the
  compulsory pure content, `MA`-`ME` Mechanics, `SA`-`SH` Statistics and `DA`-`DG`
  Discrete. Choose from these, never a statement like `C3` or `MB2`.
- Each line's `paper` says which content it holds: Papers 1 and 2 and AS Paper 1 are
  compulsory pure (A-J); Paper 3 and AS Paper 2 are one option each (Mechanics,
  Statistics or Discrete), so their questions take that option's codes. An option
  question takes a pure code only when some of its marks are for further pure maths
  (solving a second order differential equation in a mechanics question takes `I`
  after its mechanics code).
- Year 1 Maths content in a question (differentiation in a pure question, a normal
  distribution in a statistics one) is not a Further Maths topic: tag the Further
  Maths content it is set in.
