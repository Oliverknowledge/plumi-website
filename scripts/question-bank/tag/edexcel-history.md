# Edexcel History

`edexcel_history/tag_history.py split` writes Pearson Edexcel's A-Level History (9HI0) questions to
`.work/edexcel-history/tag/batch-NN.jsonl`, and `merge` collects `batch-NN.answers.json`
(`{"<id>": ["2H.1.2"], ...}`, one or two codes, the main one first). The brief is the one in `tag.md`,
with these differences:

- Each line is one whole question (an essay or a source question), with its `option` ("1H", "2H.1",
  "37.2"), its `section` (A, B or C) and the `topics` it may be tagged to: **choose only from those**.
  What each topic covers is given (`topicText`) on the first line of the batch that can use it.
- Paper 1's Sections A and B are tagged to the option's four themes (`1H.1` to `1H.4`). Its Section C
  (the interpretations question) is tagged without asking, so it isn't in the batches.
- Paper 2's questions are tagged to the option's four key topics (`2H.1.1` to `2H.1.4`).
- Paper 3's Sections A and B are tagged to its aspects in depth (`37.1.K1` to `37.1.K5`), Section C
  to its aspects in breadth (`37.1.T1`, `37.1.T2`).
- Dates are the strongest evidence for key topics: a question on "the years 1935–38" sits in the key
  topic whose dates hold them. Where a question's years run across two key topics, give both, the
  one holding most of its years first. Themes span the whole period: tag by what the question is about
  (government, religion, economy, society…), not by its dates.
- A source question is tagged by the enquiry it sets ("…to investigate X"), read against the source's
  date, not by every topic the source touches.
