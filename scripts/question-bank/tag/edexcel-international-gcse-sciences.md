# Edexcel International GCSE sciences

`edexcel_igcse/tag_igcse.py split` writes batches for Pearson Edexcel's International GCSE
Biology (4BI1), Chemistry (4CH1) and Physics (4PH1) to `.work/edexcel-igcse/tag/`, and `merge`
collects them. The brief is the Edexcel one above, with these differences:

- Codes are the specification's lettered sub-topics: `2e` is "2(e) Nutrition". Choose from
  these, never a topic number on its own.
- Each line has a `paper`. Both papers can test any topic; Paper 2 adds the statements the
  specification sets in bold (2.36B, 1.20C, 5.6P), still under the same sub-topics.
- Physics's "Units" sub-topics are left out: a question on a unit gets the sub-topic that uses it.
- Practicals get the content sub-topic they sit in.
