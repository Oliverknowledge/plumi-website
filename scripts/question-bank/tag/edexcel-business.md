# Edexcel Business

`edexcel_business/tag_business.py split` writes batches of Pearson Edexcel A-Level (9BS0)
Business parts to `.work/edexcel-business/tag/`, and `merge` collects them. The brief is
the one in `tag.md`, with these differences:

- `business-topics.txt` lists the specification's sub-topics: `code | topic | title
  — what the specification says under it`. Codes have three numbers (`1.3.3`, `4.2.5`);
  choose from these, never a topic like `1.3`. There is no AS split.
- Each line has its `paper` ("A-Level 1"). Paper 1 is drawn from Themes 1 and 4, Paper 2
  from Themes 2 and 3, and Paper 3 (a context announced the year before, then unseen
  extracts) from all four: prefer a code from the paper's own themes where one fits.
- `question` is the part's own words, then the extracts it is set on (cut short). Judge
  by what the part asks and its scheme, not by the extract's industry.
- Give a second code only for a 12-, 16- or 20-mark part that genuinely needs two topics
  ("evaluate these two options": tag what the options are, organic growth `3.2.3` against
  a takeover `3.2.2`, say).
- Where things live: market mapping, differentiation and adding value `1.1.3`; elasticity
  calculations `1.2.4` and `1.2.5`; the design mix `1.3.1`; pricing strategies `1.3.3`;
  leadership styles `1.4.5`; private limited companies, franchises and flotation `1.5.4`;
  opportunity cost and trade-offs `1.5.5`; limited liability `2.1.3`; break-even `2.2.3`;
  current and acid test ratios, working capital `2.3.2`; profit margins `2.3.1`; inflation,
  interest and exchange rates for a UK business `2.5.1`; Ansoff and Porter's strategic
  matrix `3.1.2`; PESTLE and Five Forces `3.1.4`; gearing and ROCE `3.5.2`; investment
  appraisal (payback, ARR, NPV) `3.3.2`; decision trees `3.3.3`; critical path `3.3.4`;
  stakeholders against shareholders `3.4.3`; ethics in a UK business `3.4.4`, in a
  multinational `4.4.2`; exchange rates for a business competing abroad `4.2.5`; joint
  ventures and global mergers `4.2.4`; choosing a country to sell in `4.2.2` or to produce
  in `4.2.3`; glocalisation and global marketing strategy `4.3.1`; cultural mistakes
  abroad `4.3.3`.
