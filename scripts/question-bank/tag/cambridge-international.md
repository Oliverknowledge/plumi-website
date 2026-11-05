# Cambridge International (CAIE)

`caie/tag_caie.py split` writes batches for CAIE AS & A Level Biology 9700,
Chemistry 9701 and Physics 9702 to `.work/caie-sciences/tag/`, and with
`.work/caie-maths` for Mathematics 9709 and Further Mathematics 9231; `merge`
collects them. The brief is the one in `tag.md`, with these differences:

- `<syllabus>-topics.txt` lists one sub-topic per line: `code | topic | title [AS or
  A Level only] — the syllabus's learning outcomes`. Codes have two numbers (`23.1`);
  choose from these, never a topic number like `23` on its own.
- Each science line has a `paper` ("AS Paper 2: AS Level Structured Questions").
  AS papers (1 and 2) only test topics marked [AS]; Papers 4 and 5 can test anything,
  though Paper 4 is mostly A Level content. Paper 5 (planning, analysis and evaluation)
  questions get the content topic their experiment is about.
- Paper 1 is multiple choice: `question` holds the stem and the four options, and
  `answer` the correct letter. Tag by what the question tests.
- Chemistry repeats some topic names at A Level ("23 Chemical energetics" after "5
  Chemical energetics"): an AS paper takes the AS code, an A Level paper the code
  whose learning outcomes the question needs (lattice energy is 23.1, a simple Hess
  cycle 5.2).
- Maths is tagged a whole question at a time: one to three codes, the main one first.
  The syllabus is set out by paper, and each line's `only` says which codes it may
  take: a Paper 3 question only `3.x` codes, even where Paper 1 has a topic of the
  same name.
