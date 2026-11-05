# Edexcel International GCSE Maths (4MA1)

`edexcel_igcse_maths/tag_igcse_maths.py split` writes batches for Pearson Edexcel's International GCSE
Mathematics A (both tiers) to `.work/edexcel-igcse-maths/tag/`, and `merge` collects them into `tags.json`.
The brief is the GCSE Maths one above, with these differences:

- `igcse-maths-topics.txt` lists the 4MA1 specification's own topics, one per line: `code | area | title —
  what the specification says` (Foundation content, then what the Higher tier adds). Codes run `1.1`-`1.11`,
  `2.1`-`2.8`, `3.1`-`3.4`, `4.1`-`4.11`, `5.1`-`5.2`, `6.1`-`6.3`; choose from these, never an area like `4`.
- Both papers of both tiers allow a calculator; each line's `paper` says its tier. Topics marked "Higher tier
  only" (2.5 Proportion, 3.2 Function notation, 3.4 Calculus, 5.1 Vectors) never fit a Foundation question.
- Tag what is being tested: a percentage change or compound interest is `1.6`; Pythagoras or trigonometry
  in any shape `4.8`; area and perimeter `4.9`, volume and surface area `4.10`; similar shapes `4.11`; a
  missing angle from parallel lines or polygons `4.1` or `4.2`, with `4.6` only for a circle theorem; sets and
  Venn diagrams `1.5` (probability from a Venn diagram `6.3` first); upper and lower bounds `1.8`;
  transformations of shapes `5.2`; a graph to draw or read, and transformations of graphs (y = f(x + a), y = af(x))
  `3.3`; differentiation and kinematics `3.4`.
