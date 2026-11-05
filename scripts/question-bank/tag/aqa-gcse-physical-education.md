# AQA GCSE Physical Education

`aqa_gcse_pe/tag_gcse_pe.py split` writes batches of AQA GCSE Physical Education (8582) questions
to `.work/aqa-gcse-pe/tag/`, and `merge` collects them into `tags.json`. The brief is the one at
the top, with these differences:

- `gcse-pe-topics.txt` lists one topic per line: `code | area | title — what the specification says
  under it`. Codes have four numbers (`3.1.3.2`); never an area like `3.1.3`.
- Each line is a whole question or a part ("07.2") with its `paper`, its `marks`, its words (a
  part's start with its question's stem) and the start of its scheme (for a 6- or 9-mark question,
  what the scheme credits, without the levels table; for multiple choice, `Answer: D`).
- Paper 1 takes codes from `3.1.x`, Paper 2 from `3.2.x`. The one crossing: a part that is marked for
  reading or drawing data takes `3.1.4.x` on either paper, with the content topic as well if the marks
  also need it (a table of participation by age and "explain why": `3.2.2.1` and `3.1.4.3`).
- Where topics overlap, choose by what the scheme credits: bones, muscles, joints, tendons, joint
  actions, agonists and antagonists and types of contraction are `3.1.1.1`; the pathway of air, gas
  exchange, blood vessels, the heart, cardiac output, spirometer traces and breathing `3.1.1.2`;
  aerobic and anaerobic exercise, their equations, EPOC and recovery methods (cool down, diet, ice
  baths, massage) `3.1.1.3`; immediate, short-term and long-term effects of exercise `3.1.1.4`.
- Defining and testing a component of fitness (the Illinois Agility Test, the multi-stage fitness
  test, one-rep max as a test) is `3.1.3.2`; why a component matters to a performer too. SPORT, FITT
  and the types of training (circuit, continuous, Fartlek, interval, plyometric, weight) are
  `3.1.3.3`; training zones, 220 minus age, one-rep max percentages, reps and sets, training seasons,
  altitude, injuries and their prevention, PPE `3.1.3.4`; warm up and cool down as such `3.1.3.5`.
- Definitions of skill and ability, skill classification and performance or outcome goals are `3.2.1.1`;
  SMART targets `3.2.1.2`; the information processing model `3.2.1.3`; guidance and feedback `3.2.1.4`;
  arousal, the inverted-U, stress management, aggression, personality and motivation `3.2.1.5`.
- Who takes part and why are `3.2.2.1`; sponsorship, media and technology `3.2.2.2`; conduct,
  etiquette, sportsmanship, gamesmanship, prohibited substances and methods, spectators and
  hooliganism `3.2.2.3`. Benefits of exercise to physical, mental and social health are `3.2.3.1`;
  sedentary lifestyles, obesity and somatotypes `3.2.3.2`; energy, diet, nutrients and hydration `3.2.3.3`.
- A 9-mark question that says what it wants (plyometrics for a triple jumper) goes under what it
  asks about; a second code only when the marks really split between two topics.
