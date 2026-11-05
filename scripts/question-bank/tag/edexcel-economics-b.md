# Edexcel Economics B

`edexcel_economics_b/tag_economics_b.py split` writes batches of Pearson Edexcel A-Level
(9EB0) Economics B parts to `.work/edexcel-economics-b/tag/`, and `merge` collects them.
The brief is the one in `tag.md`, with these differences:

- `economics-b-topics.txt` lists the specification's sub-topics: `code | topic | title
  — what the specification says under it`. Codes have three numbers (`1.3.1`, `4.4.2`);
  choose from these, never a topic like `1.3`. Economics B has four themes and no AS
  split, so every topic is open to every paper.
- Each line has its `paper` ("A-Level 1"). Paper 1 is drawn from Themes 1 and 4, Paper 2
  from Themes 2 and 3, and Paper 3 (a context announced the year before, then unseen
  extracts) can test anything.
- The `setup` and the start of `question` are often the extracts the question is set
  on; judge by what the part asks and its scheme, not by the extract's subject (a
  question about Tesla's productivity is `2.3.1`, not a topic about cars).
- Themes overlap by design: Theme 4 builds on Theme 1 (competition, market failure,
  government intervention) and Theme 2 on Theme 1 (growth, elasticity, efficiency).
  Tag the topic the scheme's indicative content is mostly about; give a second only for
  a 20-mark essay that genuinely needs it.
- Common confusions: business objectives `1.1.2` vs business objectives and pricing
  decisions `4.1.4`; externalities and market failure `1.5.1` vs `4.3.2`/`4.2.1` (use the
  Theme 4 code when the part is about regulation, society or the spectrum of
  competition, the Theme 1 code when it is about the externality diagram itself);
  government intervention `1.5.2` vs policies to deal with market failure `4.3.3`;
  demand-side `4.4.2` and supply-side policies `4.4.3` (AD/AS and the impact on
  firms) vs policy instruments `2.6.2` (Theme 2: the instruments themselves);
  exchange rates `2.4.4` vs exchange rate changes `3.1.5`.
