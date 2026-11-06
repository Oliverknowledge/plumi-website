# CAIE AS & A Level Psychology (9990)

`caie_psychology/tag_caie_psychology.py split` writes the cut parts to `.work/caie-psychology/tag/batch-NN.jsonl`
with `tag/topics.txt`; each batch is tagged into `batch-NN.answers.json` (`{"<id>": ["1.1", "7.5"], ...}`) and `merge`
collects them. The brief is the one in `tag.md`, with these differences:

- Codes are the syllabus's headings, not its numbers (Cambridge doesn't number the AS content):
  - `1.x` Biological, `2.x` Cognitive, `3.x` Learning, `4.x` Social approach: one topic per core study (12),
    e.g. `1.1` Dement and Kleitman (sleep and dreams), `4.1` Milgram (obedience);
  - `5.x` AS issues and debates (`5.1` application to everyday life, `5.2` individual and situational,
    `5.3` nature versus nurture, `5.4` children in research, `5.5` animals in research, `5.6` the four approaches);
  - `6.x` research methods, `7.x` methodological concepts (sampling, ethics, validity ...);
  - `A1-A5` Clinical, `B1-B5` Consumer, `C1-C5` Health, `D1-D5` Organisational psychology: the option's five areas.
- Every line says which sections its first and second code may come from (`first_code_from_sections`,
  `second_code_from_sections`); `merge` refuses anything else.
- **Papers 1 and 2 (AS)** are set on the 12 core studies. A part about a named study ("From the study by Milgram ...") is
  that study's code first, even when it asks about its ethics or method; add the method/concept/issue code (`7.6` ethics,
  `5.3` nature versus nurture) second. Paper 1's "one other study from the biological approach" comparisons take the
  named study first. A scenario about a novel study ("Glyn is conducting an experiment ...") has no core study: tag
  the method or concept it tests (`6.1`, `7.2`), and a second only if it names a study as well. Paper 2's Section B
  planning questions ("Describe how Mary could conduct a case study of doodling ...") take the method first (`6.3`)
  and a concept (`7.x`) or the study second.
- **Papers 3 and 4 (A Level)** are four options in one paper; the part's `option` says which. The first code is always one of
  that option's own areas (`A1-A5` for Clinical ...), chosen by the area the scenario or named theory belongs to
  (OCD diagnosis is `A5`, the dopamine hypothesis `A1`, gate control theory `C3`). A second code is from sections 5-7
  (the debate, method or concept the part also asks about: "Outline what is meant by the nature versus nurture debate"
  in a Health question is `C-something` first, `5.3` second), or the option's other area.
  Paper 4's Section B "plan a study" questions (10 marks, then the knowledge it is based on, then the choices
  made) take the option area their scenario is about first and the method second (`6.x`/`7.x`).
- AS issues (`5.x`) at A Level are the A Level issues (reductionism, determinism, idiographic ...): the syllabus lists
  those for A Level only, and there is no topic for them; use the option's area and leave the debate to the second
  code only where it is an AS one (`5.1`-`5.5`).
