# OCR Economics

`ocr_economics/tag_ocr_economics.py split` writes batches of OCR A-Level (H460) and AS
(H060) Economics parts to `.work/ocr-economics/tag/`, and `merge` collects them. The
brief is the one in `tag.md`, with these differences:

- `economics-topics.txt` lists the specification's topics: `code | section | number and
  title [AS] or [A-Level only] — what students should be able to do`. The specification
  numbers each component afresh (Microeconomics 2.6 Elasticity, Macroeconomics 2.6 Trends
  in macroeconomic indicators), so the codes put the component first: `1.2.6` is
  Microeconomics 2.6, `2.2.6` Macroeconomics 2.6. Choose from these codes, never a section
  like `1.2`. AS questions take the A-Level's codes (the AS specification numbers the same
  topics differently).
- Each line has its `paper` ("AS 1", "A-Level 3") and `marks`. Paper 1 (and AS 1) is
  microeconomics, codes `1.x.x`; Paper 2 (and AS 2) macroeconomics, `2.x.x`; A-Level
  Paper 3 is synoptic and can test either. AS papers only test [AS] topics.
- The `setup` is the start of the stimulus material or extracts the question is set on;
  tag by what the question asks and its scheme, not by the extract's subject (a question
  on house prices that asks for a percentage change is about the market it describes, and
  a calculation of PED is `1.2.6`).
- Multiple-choice questions (A-Level Paper 3 1–30, AS 1–15): `question` holds the stem
  and options A–D, `scheme` the key and OCR's rationale; tag the concept tested.
- The 25-mark essays (Sections B and C) and the 10–15 mark evaluations often span
  topics: give the main one first and a second only when the scheme's indicative content
  genuinely needs it (monopolistic competition's benefits to consumers: `1.4.3`; a
  minimum price for alcohol: `1.2.11` then `1.2.8`).
- Common confusions: market failure and externalities `1.2.8` vs government
  intervention `1.2.11` (a tax, subsidy, regulation or price control to correct a
  failure is `1.2.11` unless the question is about the failure itself); information
  failure `1.2.9` and public goods `1.2.10` are their own topics; the margin `1.2.7` is
  marginal utility and marginal analysis, not marginal cost in a market structure
  (`1.3.2`); the circular flow and injections/withdrawals `2.1.1` vs the multiplier
  `2.1.5`; the Bank of England's interest rate and QE `2.3.2` vs money, liquidity and
  the banking system `2.5.1`/`2.5.2`; international trade and its benefits `2.4.1`,
  comparative advantage, terms of trade and the Marshall-Lerner condition `2.4.3`,
  protectionism and trade blocs `2.4.4`.
