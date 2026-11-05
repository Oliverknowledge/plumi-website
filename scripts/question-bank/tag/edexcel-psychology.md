# Edexcel Psychology

`edexcel_psychology/tag_psychology.py split` writes Pearson Edexcel's A-Level (9PS0) and AS
(8PS0) Psychology parts to `.work/edexcel-psychology/tag/batch-NN.jsonl`, and `merge`
collects `batch-NN.answers.json` (`{"<id>": ["1.3"], ...}`, one or two codes, the main
one first). The brief is the one in `tag.md`, with these differences:

- `topics.txt` lists one topic per line: `code | topic | title — the specification's
  words`. Each of the nine topics (1 Social, 2 Cognitive, 3 Biological, 4 Learning
  theories, 5 Clinical, 6 Criminological, 7 Child, 8 Health, 9 Psychological skills) has
  the same parts: `.1 Content` (theories and concepts), `.2 Methods` (research methods,
  data analysis, statistics), `.3 Studies` (the classic and contemporary studies),
  `.4 Key questions` (applying the topic to a key question for society), `.5 Practical
  investigation` (the student's own practical), `.6 Issues and debates`. Topic 9 has
  `9.1 Methods`, `9.2 Synoptic review of studies` and `9.3 Issues and debates`.
- **Choose only from the line's `sections`**: the paper examines only those topics, and
  Paper 2's options are kept apart (a Criminological part is never tagged Child). A
  Paper 3 part takes a `9.x` code first and may take a second from any topic (the topic
  of the classic study it asks about).
- Pick the part by what it asks: describe or explain a theory or concept is `.1`; a
  sampling technique, design, a calculation, a statistical test or its result is `.2`;
  "describe/evaluate [named study]" is `.3`; applying the topic to a key question or a
  scenario about society is `.4`; a question on "your practical investigation" is `.5`;
  ethics, reductionism, nature-nurture, psychology as a science, social control and other
  debates are `.6` (`9.3` on Paper 3). A scenario question about a research design in
  social psychology is `1.2`; one that asks to apply social identity theory to the
  scenario is `1.1`.
- An essay that evaluates a theory using studies is `.1` first, `.3` second.
