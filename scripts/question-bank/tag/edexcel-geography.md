# Edexcel Geography

`edexcel_geography/tag_geography.py split` writes batches of Pearson Edexcel A-Level
(9GE0) and AS (8GE0) Geography parts to `.work/edexcel-geography/tag/`, and `merge`
collects them. The brief is the one in `tag.md`, with these differences:

- `geography-topics.txt` lists the specification's enquiry questions: `code | topic |
  enquiry question (statements 1.1–1.3) [AS] or [A-Level only] — its key ideas`. Codes
  look like `1.EQ2` or `2A.EQ3`; choose from these, never a topic like `2A`.
- Each line has its `paper` ("AS 1", "A-Level 2"). A-Level Paper 1 tests topics 1, 2A or
  2B, 5 and 6; Paper 2 topics 3, 4A or 4B, 7, and 8A or 8B; Paper 3 (the synoptic
  investigation, set on a resource booklet about one place) can test anything. AS Paper 1
  is topics 1 and 2A or 2B, AS Paper 2 topics 3 and 4A or 4B.
- Options: students answer one of two questions (or, at AS, sections). Tag each option's
  parts to that option's topic: glaciers and glaciated landscapes are `2A`, coasts `2B`,
  regeneration `4A`, diverse places and population `4B`, health, human rights and
  intervention `8A`, migration, identity and sovereignty `8B`. Never tag a glaciated
  question to a coastal topic because the two questions are worded alike.
- The `question` can run on into the resource booklet's figures (its stem); judge by what
  the part asks and its scheme. Skills and fieldwork parts (a Spearman's rank calculation,
  "explain one advantage of using oral accounts", "assess how your sampling affected your
  conclusions") get the enquiry question of the option or topic they sit in, chosen by what
  the data is about.
- Paper 3 parts: tag by the content the scheme rewards (a question on the place's
  vulnerability to earthquakes is `1.EQ2`; on its trade and TNCs `3.EQ1` or `3.EQ2`), with
  a second code when the scheme's indicative content draws equally on two topics.
