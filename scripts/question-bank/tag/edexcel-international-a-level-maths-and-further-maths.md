# Edexcel International A Level Maths and Further Maths (YMA01, YFM01)

`edexcel_ial_maths/tag_ial_maths.py split` writes batches of Pearson Edexcel's International A Level unit papers
(P1-P4, FP1-FP3, M1-M3, S1-S3, D1) to `.work/edexcel-ial-maths/tag/`, and `merge` collects them into `tags.json`.
The brief is the one in `tag.md`, with these differences:

- Each line is a whole question from one unit, and carries `topics`: that unit's own numbered topics as the
  specification prints them (`P3.4 Differentiation`, `S2.1 The Binomial and Poisson distributions`). Choose from
  those only; merge keeps nothing else. `ial-maths-topics.txt` lists every unit's.
- Tag what the marks are for, by the scheme: a P4 question that differentiates parametric equations is `P4.5`,
  not `P4.3`; a P3 question that solves a trig equation is `P3.2`. Give a second code only where a large share of
  the marks needs a second topic (an S1 question half on probability, half on the Normal distribution).
- Prior knowledge a unit assumes (differentiation in M2, integration in S2's continuous random variables) is not a
  topic of its own: tag the unit topic the question is set in.
