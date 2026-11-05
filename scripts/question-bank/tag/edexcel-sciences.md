# Edexcel (Pearson) sciences

`edexcel_sciences/tag_pearson.py split` writes the same kind of batches for
Edexcel Biology A, Biology B, Chemistry and Physics to
`.work/edexcel-sciences/tag/`, and `merge` collects them. The brief is the one
above, with these differences:

- `<subject>-topics.txt` lists one sub-topic per line: `code | topic | title — what
  the specification says under it`. Choose from these codes (`6.B`, `1.4`, `2.3`),
  never a topic number on its own.
- Biology A and Physics have no printed sub-topic codes: their sub-topics group
  the specification's numbered statements, shown in brackets. Tag by content.
- Each line has a `paper` ("AS 1", "A-Level 3"). AS papers only test topics
  marked [AS]; A-Level Paper 3 can test anything.
- Biology A Paper 3 questions about the pre-release scientific article still get
  the content topic they test.
