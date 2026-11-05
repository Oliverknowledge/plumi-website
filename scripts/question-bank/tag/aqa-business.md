# AQA Business

`aqa_business/tag_business.py split` writes batches of AQA A-Level (7132) and AS (7131)
Business questions to `.work/aqa-business/tag/`, and `merge` collects them. The brief
is the one in `tag.md`, with these differences:

- `business-topics.txt` lists the specification's topics: `code | area | title [AS] or
  [A-Level only] — what the specification says under it`. Codes have three numbers
  (`3.5.2`, `3.10.1`); choose from these, never an area like `3.5`.
- Each line has its `paper` ("AS 1", "A-Level 3"), `label` and `marks`. AS papers only
  test the [AS] topics (3.1 to 3.6). On A-Level papers prefer the A-Level topic where
  one fits: interest rates, exchange rates or the economy are `3.7.5` there, but `3.1.3`
  on an AS paper.
- `question` is the question's own words first, then its case study or shared data (cut
  short). Judge by what the question asks and its scheme ("The demands of the question
  are…"), not by the case's subject. Multiple-choice questions carry their answer as
  `scheme` ("Answer: B").
- Essays and 16- to 25-mark questions often span topics: give the main one first and a
  second only when the question genuinely needs it ("financial or non-financial
  motivation to raise labour productivity" is `3.6.4`; "is innovation essential to
  differentiation" is `3.8.2` then `3.9.2`).
- Where things live: decision trees and expected values `3.2.2`; stakeholder mapping
  `3.2.3`; leadership styles `3.2.1`; market research, sampling, elasticity, correlation
  and marketing data `3.3.2`; segmentation and market mapping `3.3.3`; the 7Ps, pricing,
  product life cycle and Boston matrix `3.3.4`; capacity utilisation, unit costs and
  operations data `3.4.2`; lean production, technology and efficiency `3.4.3`; quality
  `3.4.4`; inventory, JIT, suppliers and outsourcing `3.4.5`; profit and profit margins
  `3.5.1`; budgets, variances, cash-flow forecasts, break-even, contribution and margin
  of safety `3.5.2`; sources of finance and debt factoring `3.5.3`; improving cash flow
  or profit `3.5.4`; hard and soft HRM, HR objectives `3.6.1`; labour turnover,
  retention and HR data `3.6.2`; structure, spans of control, delayering, centralisation,
  workforce planning `3.6.3`; motivation theories and methods `3.6.4`; trade unions,
  works councils, employee involvement `3.6.5`; mission, objectives and SWOT `3.7.1`;
  financial ratios (current ratio, gearing, ROCE, payables/receivables days, inventory
  turnover) `3.7.2`; non-financial performance, the balanced scorecard and Elkington's
  Triple Bottom Line `3.7.3`; legislation and government policy `3.7.4`; the economy,
  interest and exchange rates, globalisation's economic side `3.7.5`; CSR, ethics and
  social or technological change `3.7.6`; Porter's five forces `3.7.7`; payback, ARR
  and NPV `3.7.8`; Ansoff `3.8.1`; Porter's generic strategies and Bowman's strategic
  clock `3.8.2`; growth, mergers and takeovers, economies of scale, franchising,
  retrenchment `3.9.1`; innovation, R&D, kaizen `3.9.2`; international markets,
  offshoring and reshoring `3.9.3`; digital technology, e-commerce, big data `3.9.4`;
  change, resistance, Lewin, Kotter and Schlesinger, flexible organisations `3.10.1`;
  organisational culture, Handy, Hofstede `3.10.2`; implementing strategy, network
  analysis and the critical path `3.10.3`; strategic drift, planned v emergent strategy,
  why strategies fail `3.10.4`. A ratio or appraisal on an AS paper takes the [AS]
  topic it sits in (a profit margin `3.5.1`, labour productivity `3.6.2` or `3.4.2`).
