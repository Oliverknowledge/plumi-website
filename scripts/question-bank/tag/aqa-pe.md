# AQA PE

`aqa_pe/tag_pe.py split` writes batches of AQA A-Level Physical Education (7582) questions to
`.work/aqa-pe/tag/`, and `merge` collects them into `tags.json`. The brief is the one in `tag.md`,
with these differences:

- `pe-topics.txt` lists one topic per line: `code | area | title — what the specification says
  under it`. Choose from these codes, never an area. Most are four numbers (`3.1.1.6` Energy
  systems); Sport psychology is fourteen five-number topics (`3.2.3.1.1` Aspects of personality …
  `3.2.3.1.14` Stress management), and the history of sport three (`3.1.3.1.1` pre-industrial,
  `3.1.3.1.2` industrial and post-industrial 1780–1900, `3.1.3.1.3` post World War II).
- Each line is a whole question (or a part, "04.2") with its `paper`, the `section` of the paper
  it sits in, its `marks`, its words and the start of its scheme (for an 8- or 15-mark question,
  what the scheme credits, without the levels table; for multiple choice, `Answer: D`).
- **The section fixes the area.** Paper 1 Section A is Applied anatomy and physiology (`3.1.1.x`),
  B Skill acquisition (`3.1.2.x`), C Sport and society (`3.1.3.x`); Paper 2 Section A is Exercise
  physiology (`3.2.1.x`) and Biomechanical movement (`3.2.2.x`), B Sport psychology (`3.2.3.1.x`),
  C Sport and society and technology (`3.2.4.x`). The first code is always from that area.
- A 15-mark question that asks for two areas' knowledge on purpose (Paper 1 Section A's last
  question often joins anatomy with biomechanics or skill: "Recruitment of muscle fibres and
  Newton's laws") takes the second area's topic as its second code. Otherwise a second code only
  when the marks really split between two topics (personality and arousal, levers and Newton's laws).
- Where topics overlap, choose by what the scheme credits: cardiac output, heart rate, blood
  pressure, venous return, vascular shunting and the cardiac conduction system are `3.1.1.2`; lung
  volumes, gas exchange, ventilation and smoking `3.1.1.3`; motor units, muscle fibre types, PNF and
  proprioceptors `3.1.1.4`; joints, agonists, planes and axes `3.1.1.5`; ATP, the energy systems,
  EPOC, VO2 max, lactate and energy expenditure `3.1.1.6`; `3.1.1.1` only for a question about the
  two systems working together. Training methods, periodisation, FITT, altitude and HIIT are
  `3.2.1.2`; supplements and diet `3.2.1.1`; injury, recovery and rehabilitation `3.2.1.3`.
  Memory models and information processing (Whiting, Baddeley and Hitch, reaction time, anticipation,
  Schmidt's schema) are `3.1.2.5`; theories of learning (operant conditioning, insight, observational
  learning, Vygotsky, the stages of learning, plateaus) `3.1.2.3`. Sociological theory, social
  stratification, socialisation, barriers to participation and Sport England's partners are
  `3.1.3.2`. Commercialisation, sponsorship, media and the Golden Triangle are `3.2.4.7`, except
  as part of 1780–1900 or post-war history, which is the era's topic.
