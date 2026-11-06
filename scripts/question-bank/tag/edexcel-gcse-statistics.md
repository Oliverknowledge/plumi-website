# Edexcel GCSE Statistics

`edexcel_gcse_statistics/tag_gcse_statistics.py split` writes batches of Pearson Edexcel GCSE Statistics
(1ST0) questions, both tiers, to `.work/edexcel-gcse-statistics/tag/`, and `merge` collects them into
`tags.json`. The brief is the one in `tag.md`, with these differences:

- Statistics is tagged a whole question at a time, as the maths banks are: one to three codes, the main one
  first (the topic most of the marks are for).
- `statistics-topics.txt` lists one topic per line: `code | area | title — the specification's statements`. The
  codes are the specification's lettered groups (`1c` population and sampling, `2e` scatter diagrams and
  correlation); choose from these, never an area like `2`. Each statement is shown with its own code in
  brackets (`[2c.04]`), so you can tell what a group covers. Probability is one group in the specification
  (`3p`); here it is split into `3a` (estimating and comparing probabilities, `3p.01`-`3p.06`), `3b` (two-way
  tables, tree and Venn diagrams, independent and conditional events, `3p.07`-`3p.09`) and `3c` (binomial and
  normal distributions, `3p.10`-`3p.13`). Foundation and Higher papers take the same codes.
- Each line has the `paper` (Paper 1 or 2, and its tier), its `marks`, the question's words (`question`, as the
  PDF's text layer gives them: a table or a graph's labels can come out jumbled), the start of its `scheme`, and
  `image`, the path of the question's crop. Look at the image whenever the words don't make the question
  clear: a table, a histogram, a box plot or a scatter graph is the question.
- Tag what is being tested, not the context. A question that asks for a mean from a table is `2b`; "describe the
  correlation" and a line of best fit are `2e`; the interquartile range and standard deviation are `2c`;
  quartiles read from a cumulative frequency graph are `2c` with `2a` when it also asks for the graph to be
  drawn; a histogram with unequal class widths or a pie chart's angles are `2a`; a moving average and the
  seasonal pattern are `2f`; a control chart is `2g`; capture-recapture and "is this sample large enough to
  trust?" are `2h`. Questions about a survey's bias, a questionnaire's wording, a pilot study or a sampling
  method are `1c` or `1d`, a hypothesis or an enquiry's plan `1a`, the type of a variable (discrete, ordinal,
  continuous) `1b`.
- A question that is a short enquiry in several parts (a data set, then a chart, then a conclusion) takes the
  topic carrying most of the marks first, then the next.
