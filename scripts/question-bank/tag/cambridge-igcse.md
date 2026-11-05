# Cambridge IGCSE

`caie/tag_caie.py split scripts/question-bank/.work/caie-igcse-sciences` writes batches
for IGCSE Biology 0610, Chemistry 0620 and Physics 0625, and with
`.work/caie-igcse-maths` for Mathematics 0580 and Additional Mathematics 0606 (0980's
June 2024 papers are batched with 0580's, under its topics). The brief is the CAIE one
above, with these differences:

- No AS here: topics carry no year marker. Each line's `paper` says whether it is
  Core ("Paper 3: Theory (Core)") or Extended. Core papers (1 and 3) only test the Core
  statements of a sub-topic; Extended papers (2 and 4) test Core and Supplement.
- Paper 6 (alternative to practical) questions get the content topic their experiment
  is about; Chemistry has its own topic 12 (experimental techniques and chemical
  analysis) for apparatus, titrations, chromatography, separation and tests for ions
  and gases, which takes them where that is what the marks are for.
- Mathematics 0580 is tagged a whole question at a time, one to three codes, the main
  one first. Its sub-topics are numbered as the syllabus's Extended content (`2.12`
  for E2.12); those marked [Extended only] are never a Core paper's (1 or 3), and
  merge drops them there. The June 2024 papers (legacy syllabus) are tagged to the
  2025 syllabus's topics, whose content is the same.
- Additional Mathematics 0606 has one code per topic (`6` for logarithmic and
  exponential functions, the topic's learning statements after the dash): one to three
  codes per question.
