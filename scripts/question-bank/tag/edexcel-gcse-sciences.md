# Edexcel GCSE sciences

`edexcel_gcse/tag_gcse.py split` writes batches for Pearson Edexcel's GCSE Biology (1BI0),
Chemistry (1CH0) and Physics (1PH0) to `.work/edexcel-gcse/tag/`, and `merge` collects
them. The brief is the Edexcel one above, with these differences:

- Every sub-topic groups the specification's numbered statements (shown in brackets,
  `2.20–2.23`); a code like `6.2` is the second group of Topic 6, not statement 6.2. Tag
  by content.
- Each line has a `paper` ("Paper 2 Foundation"). Topic 1, the key concepts, is on both
  papers; the rest are on one (each topic line says which). A Paper 2 question can still
  lean on Topic 1 (cells, atoms, units).
- Foundation and Higher papers share questions; tag each copy on its own.
- Core practicals get the content topic they sit in (the osmosis practical is
  "Diffusion, osmosis and active transport").
