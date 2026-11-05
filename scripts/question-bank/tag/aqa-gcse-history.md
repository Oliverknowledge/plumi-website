# AQA GCSE History

`aqa_gcse_history/tag_gcse_history.py split` writes AQA's GCSE History (8145) questions to
`.work/aqa-gcse-history/tag/`, one batch per option (`batch-1AB.jsonl`, Germany), and `merge`
collects them. The brief is the one in `tag.md`, with these differences:

- `topics-<option>.txt` lists the option's topics: `code | option | part | title — what the
  specification says under it`. A question's option is its paper (8145/1A/B is 1AB), so choose
  only from the batch's own file. A topic is one of the specification's bullets ("Weimar
  democracy"), under its part ("Part one: Germany and the growth of democracy").
- Every question is one part. `sources` is its sources or interpretations; judge by the question
  and the scheme's examples, which say what period and issue the answer is about.
- Paper 2 Section B's question 4 (`2B?` batches, `"question": 4`) is on the year's historic site:
  always `<option>.site`. A thematic study's question that spans its whole period ("Has war been
  the main factor in the development of surgery?") gets the bullet whose content it is most
  about, and a second only where it plainly needs two.
- One code nearly always.
