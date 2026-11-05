# Edexcel GCSE Business

`edexcel_gcse_business/tag_gcse_business.py split` writes batches of Pearson Edexcel GCSE
Business (1BS0) parts to `.work/edexcel-gcse-business/tag/`, and `merge` collects them. The
brief is the one in `tag.md`, with these differences:

- `business-topics.txt` lists one sub-topic per line: `code | topic | title — the
  specification's content`. The codes are the specification's numbered sub-topics (`1.3.2`
  revenues, costs and profits, `2.2.2` price); choose from these, never a topic like `1.3`.
- **Each line says which codes it may take first** (`first`): Paper 1 tests Theme 1
  (`1.x.x`), Paper 2 Theme 2 (`2.x.x`). merge rejects any other first code. A second code may
  come from either theme, and only when the part needs it as much as the first (a Paper 2
  question on financing growth: `2.1.1` with `1.3.4`).
- Sections B and C are set on a case study, at the end of `setup`: it tells you the business,
  not the topic. Tag the concept the part asks about ("Justify which one of these two options",
  overdraft or trade credit, is `1.3.4` sources of finance).
- Calculations go to the content they calculate: total costs, break even and margin of safety
  `1.3.2`, net cash flow and closing balances `1.3.3`, interest `1.3.2`, gross and net profit
  and their margins and average rate of return `2.4.1`, a percentage change or average read off
  a table or chart `2.4.2` (or the content the figure is about, on Paper 1). Multiple choice
  questions are tagged by the term they test.
