# Edexcel A level Statistics and AS Statistics (9ST0, 8ST0)

`edexcel_statistics/tag_statistics.py split <work-dir>` writes batches of whole questions to `<work-dir>/tag/`, and
`merge` collects them into `tags.json`. The brief is the one in `tag.md`, with these differences:

- Each line is a whole question from one paper, with its words, the start of its scheme and the path of its crop.
  Choose from the specification's 21 numbered topics, which `statistics-topics.txt` lists with their wording:
  `D.1` is topic 1 (Numerical measures, graphs and diagrams), `H.8` is topic 8 (Introduction to hypothesis testing),
  `R.14` is topic 14 (Sampling, estimates and resampling). The letter is only the section they are shelved under;
  the number is the specification's. Never invent a code or use a section letter alone. Merge keeps nothing else.
- Tag what the marks are for, by the scheme. A question that finds a binomial probability and then tests a
  hypothesis about the proportion is `B.5` and `H.8` only if each carries a large share of its marks.
- Name the topic, not the technique used inside it. Type I and Type II errors are part of hypothesis testing
  (`H.8`, `H.15`), not a topic of their own; the t-distribution confidence interval is `H.15`; a two-sample test is
  `H.16`; a paired test `H.17`.
- Papers 1 to 3 of 9ST0 and AS Papers 1 and 2 share the topics, so no paper restricts the codes.
- The Statistical Enquiry Cycle is assessed inside every topic. It is not a topic: tag the content the question is about.
- Give a second code only where a large share of the marks needs a second topic.
