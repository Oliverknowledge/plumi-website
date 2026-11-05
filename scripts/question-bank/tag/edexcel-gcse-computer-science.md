# Edexcel GCSE Computer Science

`edexcel_cs/tag_cs.py split` writes batches of Pearson Edexcel GCSE Computer Science (1CP2)
parts to `.work/edexcel-cs/tag/`, and `merge` collects them. The brief is the one in `tag.md`,
with these differences:

- `cs-topics.txt` lists one topic per line: `code | section | short title — the
  specification's point`. The codes are the specification's numbered points (`2.1.3`,
  `4.1.5`); choose from these, never a section like `2.1`.
- Each line has a `paper`. Paper 1 tests Topics 1 to 5 only (codes `1.x.x` to `5.x.x`);
  Paper 2 tests Topic 6 only (`6.x.x`). merge drops a code from the wrong paper.
- Paper 1 questions are each set on one topic area ("1 Networks", "3 Data" at the start of
  `setup`), but tag the point the part tests, not the area alone.
- Algorithms on Paper 1 (flowcharts, pseudocode, program code to complete or trace) are
  Topic 1: tracing or giving an output is `1.2.4`, a sort or search `1.2.6`, writing or
  completing an algorithm `1.2.1`, unless the part is plainly about one thing (operators
  `1.2.3`, errors `1.2.5`, a truth table `1.3.1`).
- A file size or transfer time calculation is `2.3.1` or `4.1.5`, by what is being worked out.
- Each Paper 2 line is a whole programming question ("Open file Q04.py…"): tag its main
  skill and, where the question is as much about a second, that one too (reading a file
  `6.4.2` with validation `6.4.3`; fixing errors `6.1.5`; "identify the constant / the
  selection construct" `6.2.1`).
