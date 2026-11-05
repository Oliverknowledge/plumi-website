# AQA Psychology

`aqa_psychology/tag_psychology.py split` writes batches of AQA A-Level (7182) and AS
(7181) Psychology questions to `.work/aqa-psychology/tag/`, and `merge` collects
them. The brief is the one in `tag.md`, with these differences:

- `psychology-topics.txt` lists one topic per line: `code | group | title — what
  the specification says under it`. Choose from these codes (`4.1.2`, `4.2.3.2`,
  `4.3.5`), never a group. Research methods is four topics: `4.2.3` the methods
  themselves (experiments, observation, self-report, correlations, content
  analysis, case studies), `4.2.3.1` scientific processes (aims, hypotheses,
  sampling, designs, variables, controls, ethics, reliability, validity, peer review,
  reporting and referencing), `4.2.3.2` data handling and analysis (types of data,
  descriptive statistics, graphs, distributions, calculations) and `4.2.3.3`
  inferential testing (probability, significance, choosing and using a test, Type I
  and II errors).
- Each line is a whole question (rarely a part, "06.1"), with its `paper` ("AS 1",
  "A-Level 3"), the `section` of the paper it sits in ("Section C: Schizophrenia"),
  its `marks`, its words (with any scenario or table printed above it) and the
  start of its scheme (for an essay, what the scheme credits, without the levels table).
- **Paper 3 option sections** (A-Level 3, Sections B, C and D): the first code is
  always that section's option topic (Relationships `4.3.2` … Addiction `4.3.10`),
  whatever the question asks. If it is a research-methods question (a sampling
  method, a statistical test, a referencing convention), add the research-methods
  topic it tests as the second code.
- **Everywhere else**, tag what the question tests. A research-methods question set
  in a topic's section ("identify the experimental design" in Section B: Memory)
  gets its research-methods topic; add the section's topic second only when the
  answer needs knowledge of it too (explaining a memory finding from the data). Paper
  3 Section A is Issues and debates (`4.3.1`). An approaches question on the
  biological approach is `4.2.1`; one on the nervous system, neurons, hormones, the
  brain or biological rhythms is `4.2.2`.
