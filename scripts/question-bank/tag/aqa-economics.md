# AQA Economics

`aqa_economics/tag_economics.py split` writes batches of AQA A-Level (7136) and AS
(7135) Economics questions to `.work/aqa-economics/tag/`, and `merge` collects them.
The brief is the one in `tag.md`, with these differences:

- `economics-topics.txt` lists the A-Level specification's sub-topics: `code | topic |
  title [AS] or [A-Level only] — what the specification says under it`. Codes have
  four numbers (`4.1.3.2`, `4.2.6.4`); choose from these, never a topic like `4.1.3`.
  AS papers use the same codes (the AS content is the [AS] sub-topics).
- Each line has its `paper` ("AS 1", "A-Level 3"). Paper 1 (AS and A-Level) is
  microeconomics (`4.1`), Paper 2 macroeconomics (`4.2`); A-Level Paper 3 can test
  anything. AS papers only test [AS] sub-topics.
- `question` is the question's own words first, then the extracts of the context it
  is set on (cut short). Judge by what the question asks and its scheme, not by the
  extract's subject: a calculation of a percentage change from a table is `4.2.1.3`
  (index numbers) only when it is about index numbers; otherwise tag the concept the
  data is used for, or `4.1.1.1` for a plain data calculation in a micro context.
- Multiple-choice questions carry their answer as `scheme` ("Answer: B"); tag by the
  concept tested.
- The 15- and 25-mark questions and essays often span several sub-topics: give the
  main one first and a second only when the question genuinely needs it.
- Common confusions: externalities `4.1.8.4` vs government intervention `4.1.8.9` (a
  tax or regulation to correct a market failure is `4.1.8.9` unless the question is
  about the failure itself); monetary policy and the Bank of England `4.2.4.3`;
  fiscal policy `4.2.5.1`; the balance of payments `4.2.6.3`; exchange rates `4.2.6.4`;
  inequality and poverty `4.1.7.x`; labour markets `4.1.6.x`.
