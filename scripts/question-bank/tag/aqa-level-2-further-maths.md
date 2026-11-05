# AQA Level 2 Further Maths

`aqa_l2_further_maths/tag_l2fm.py split` writes batches for AQA's Level 2 Certificate
in Further Mathematics (8365) to `.work/aqa-l2fm/tag/`, and `merge` collects them into
`.work/aqa-l2fm/tags.json`. The brief is GCSE Maths', with these differences:

- `l2fm-topics.txt` lists the specification's statements, one per line: `code | area |
  title: what the specification says`. Codes run `1.1`-`1.3`, `2.1`-`2.22`, `3.1`-`3.9`,
  `4.1`-`4.9`, `5.1`-`5.4`, `6.1`-`6.10`; choose from these.
- Tag the technique the marks are for, not the setting: a tangent to a curve is `4.4`
  even when the curve is a circle's equation solved for y; the stationary points of a
  cubic are `4.7`, and `4.8` only when they answer a problem in context (a box's
  greatest volume); a matrix question is `5.1` when it is only multiplying, `5.3` or
  `5.4` when it is about the transformation. Solving a trigonometric equation that needs
  an identity first takes `6.10` then `6.9`.
