# AQA GCSE Business

`aqa_gcse_business/tag_gcse_business.py split` writes batches of AQA GCSE Business (8132)
parts to `.work/aqa-gcse-business/tag/`, and `merge` collects them. The brief is the one at
the top, with these differences:

- `gcse-business-topics.txt` lists one topic per line: `code | area | title — the
  specification's words`. Codes have three numbers (`3.6.2`); never an area like `3.6`.
- **Each line says which codes it may take** (`allowed`): Paper 1 takes 3.1 Business in the
  real world, 3.2 Influences on business, 3.3 Business operations and 3.4 Human resources;
  Paper 2 takes 3.1, 3.2, 3.5 Marketing and 3.6 Finance. merge rejects anything else.
- `question` is the part's own words, `items` the start of the case it is set on. Judge by
  what the part asks and its scheme, not by the business in the items. Multiple-choice parts
  carry their answer as `scheme` ("Answer: B").
- 9- and 12-mark questions often weigh two options: give the topic the decision is about
  first, and a second only when the scheme needs both in equal measure.
- Where things live: enterprise, entrepreneurs, factors of production, opportunity cost,
  business failure `3.1.1`; sole traders, partnerships, ltd and plc, limited liability, not
  for profit `3.1.2`; aims and objectives, measuring success `3.1.3`; stakeholders and their
  conflicts `3.1.4`; location `3.1.5`; business plans `3.1.6`; organic and external growth,
  mergers, takeovers, franchising, economies and diseconomies of scale, going public `3.1.7`;
  e-commerce, digital communication `3.2.1`; ethics, the environment, sustainability, Fair
  Trade `3.2.2`; interest rates, unemployment, consumer income, inflation, the economic cycle
  `3.2.3`; globalisation, exchange rates, imports and exports, multinationals, tariffs and
  trade blocs `3.2.4`; employment, health and safety and consumer law, the minimum wage
  `3.2.5`; competition, market share, uncertainty and risk `3.2.6`; job, batch and flow
  production, automation, productivity `3.3.1`; stock control, JIT and JIC, bar gate charts,
  suppliers, logistics, procurement `3.3.2`; quality control and assurance, TQM `3.3.3`;
  customer service, product knowledge, after-sales `3.3.4`; organisational charts, tall and
  flat structures, spans of control, chains of command, delayering, centralisation,
  communication, contracts (full-time, part-time, zero hours, flexible hours, temporary,
  freelance) `3.4.1`; recruitment, job descriptions and person specifications, internal and
  external recruitment, selection `3.4.2`; financial and non-financial motivation, retention
  `3.4.3`; induction, on-the-job and off-the-job training, appraisal `3.4.4`; customer needs
  and wants `3.5.1`; segmentation `3.5.2`; primary and secondary research, sampling,
  qualitative and quantitative data `3.5.3`; price, product, promotion, place, product life
  cycle, extension strategies, Boston matrix, branding, the marketing mix together `3.5.4`;
  sources of finance, loans, overdrafts, share capital, crowdfunding `3.6.1`; cash flow,
  cash-flow forecasts, net cash flow, opening and closing balances `3.6.2`; revenue, costs,
  profit, interest, break-even, average rate of return, unit costs `3.6.3`; income statements,
  statements of financial position, gross and net profit margins, analysing financial
  performance `3.6.4`. A calculation takes the topic of what it calculates (a closing balance
  `3.6.2`; a break-even output or ARR `3.6.3`; a net profit margin `3.6.4`; a percentage
  change in sales, `3.6.3` on Paper 2, or the topic it measures on Paper 1, a labour turnover
  or productivity figure `3.4.3` or `3.3.1`).
