# GCSE Maths (AQA, Edexcel and OCR, both tiers)

`gcse_maths/tag_gcse_maths.py split` writes batches for the three GCSE Maths
banks together (AQA 8300, Pearson Edexcel 1MA1, OCR J560) to `.work/gcse-maths/tag/`,
and `merge` collects them into each board's `tags.json`: batches 1 to 31 are the Higher
papers, 32 to 65 the Foundation ones (split leaves out what is already tagged). The brief is the one at the
top, with these differences:

- Maths is tagged a whole question at a time, as the other maths banks are: one to
  three codes, the main one first (the topic most of the marks are for).
- `gcse-maths-topics.txt` lists the DfE subject content every board teaches, one
  statement per line: `code | area | title — what the specification says`. Codes run
  `N1`-`N16`, `A1`-`A25`, `R1`-`R16`, `G1`-`G25`, `P1`-`P9`, `S1`-`S6`; choose from
  these. OCR numbers its own sections differently but covers the same statements, so
  its questions take the same codes.
- Each line has a `paper` saying whether a calculator is allowed, its `marks`, the
  question's words (`question`, as the PDF's text layer gives them: fractions, powers
  and roots can come out jumbled), the start of its `scheme`, and `image`, the path of
  the question's crop. Look at the image whenever the words don't make the question
  clear (a graph or diagram question, or garbled algebra).
- Tag what is being tested, not the context: a percentage change worked out from a
  bank balance is `R9`, compound interest `R16`; Pythagoras or trigonometry in a 3D
  shape is `G20`; finding a missing angle from parallel lines is `G3`, with `G10`
  only when a circle theorem is used. Proof questions take the content they prove
  (`A6` for algebraic proof, `G6` or `G10` for geometric).
