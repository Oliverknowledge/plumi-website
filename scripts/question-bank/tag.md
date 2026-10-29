# Tagging question parts to spec topics

`tag_batches.py split` writes batches of question parts to `.work/tag/`. Each
batch is tagged by a model reading this brief, and `tag_batches.py merge`
collects the answers into `.work/tags.json` for `build_bank.py`.

The tags were made on 23 October 2026 by Claude subagents, one per few batches,
following exactly the instructions below. To re-tag after a new exam series,
split, tag only the new batches the same way, merge, and rebuild.

## The brief

You are tagging AQA A-Level exam question parts to the topic of the AQA
specification they test.

Inputs:
- `<subject>-topics.txt`: the specification's sections (`3.1 Physical chemistry`)
  and topics (`3.1.2 Amount of substance — <what the topic covers>`).
- `batch-NN-<subject>.jsonl`: one question part per line, with `id`, `setup`
  (the start of the whole question, for context), `question` (this part's own
  words) and `scheme` (the start of its mark scheme).

For every line, choose the **topic code** (three numbers, like `3.2.2`, never a
section like `3.2`) that the part is mainly testing. Add a second code only when
the part genuinely needs two topics in equal measure (for example a calculation
that is half energetics, half equilibria). Judge by what a student must know to
score the marks, using the scheme as the strongest evidence; the setup tells you
the context, not necessarily the topic.

Practical-skills and maths-skills parts still get the content topic they sit in.
Write `batch-NN-<subject>.tags.json` next to the batch: one JSON object mapping
every `id` in the batch to a list of one or two codes. Every id must appear.

## AQA GCSE sciences

The same brief, run on `.work-gcse/tag/` (`tag_batches.py split scripts/question-bank/.work-gcse`).
The GCSE specifications number their content 4 rather than 3, so topic codes look
like `4.6.2`, and every topic line lists the sub-topics it covers. Foundation and
Higher papers share some questions; tag each copy on its own.

## Edexcel (Pearson) sciences

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

## Edexcel GCSE sciences

`edexcel_gcse/tag_gcse.py split` writes batches for Pearson Edexcel's GCSE Biology (1BI0),
Chemistry (1CH0) and Physics (1PH0) to `.work/edexcel-gcse/tag/`, and `merge` collects
them. The brief is the Edexcel one above, with these differences:

- Every sub-topic groups the specification's numbered statements (shown in brackets,
  `2.20–2.23`); a code like `6.2` is the second group of Topic 6, not statement 6.2. Tag
  by content.
- Each line has a `paper` ("Paper 2 Foundation"). Topic 1, the key concepts, is on both
  papers; the rest are on one (each topic line says which). A Paper 2 question can still
  lean on Topic 1 (cells, atoms, units).
- Foundation and Higher papers share questions; tag each copy on its own.
- Core practicals get the content topic they sit in (the osmosis practical is
  "Diffusion, osmosis and active transport").

## OCR sciences

`ocr/tag_ocr.py split` writes batches for OCR's A-Level Biology A, Chemistry A
and Physics A to `.work/ocr-sciences/tag/`, and `merge` collects them. The brief is
the one at the top, with these differences:

- `<subject>-topics.txt` lists one topic per line: `code | section | title [AS or
  A-Level only] — what the specification says under it`. Codes have three numbers
  (`3.1.2`); choose from these, never a section like `3.1`.
- Each line has a `paper` ("AS 1", "A-Level 3"). AS papers only test topics marked
  [AS] (Modules 2-4); A-Level Paper 3 is synoptic and can test anything.
- Module 1 (practical skills) has no codes here: practical questions get the content
  topic they sit in.

## OCR B sciences

`ocr/tag_ocr.py split --b` writes batches for OCR's A-Level Biology B (Advancing
Biology, H422 and AS H022), Chemistry B (Salters, H433 and AS H033) and Physics B
(Advancing Physics, H557 and AS H157) to `.work/ocr-b-sciences/tag/`, and `merge --b`
collects them. The brief is the one at the top with the OCR section's differences
(`paper`, [AS] topics, Module 1 practical skills tagged to their content), and these:

- **Biology B** topics are numbered as Biology A's (`3.2.2 The immune system`). AS is
  Modules 2 and 3.
- **Chemistry B** is taught through storylines, and its topics are the chemical ideas
  under each one: `EL.2 | EL Elements of life | Atomic structure (EL(e)–(h))`. Codes are
  the storyline and a number (`EL.2`, `CI.1`); the letters in brackets are the
  learning outcomes the topic covers. The same idea comes up in several storylines
  (Kinetics in DF, OZ, CI and PL; Energy and matter in five), so read what each one's
  outcomes say and choose the storyline that teaches what the marks need, whatever
  the question's context: rate equations and orders are `CI.1`, catalysts `DF.4`,
  activation enthalpy and the Boltzmann distribution `OZ.2`, enzymes `PL.2`, Kc and moving
  an equilibrium `ES.4`, Kc with units, temperature's effect on K and operating
  conditions `CI.2`, pH, Ka and buffers `O.2`. AS papers only take the
  AS storylines (EL, DF, ES, OZ, WM).
- **Physics B** topics are its numbered units (`3.1.2 Sensing`, `4.2 Space, time and
  motion`, `5.1.1 Creating models`), plus `2.0 Fundamental data analysis`: uncertainty,
  accuracy and precision, resolution and sensitivity, plots, best-fit lines and
  uncertainty bars. Give `2.0` to a part that tests handling data or uncertainty
  itself; a part that uses an experiment's data to test physics gets that physics.
- **Paper 2** (Scientific literacy) is set partly on an advance notice article the
  candidates have read; tag the content the part tests, not the article. **Paper 3**
  (Practical skills) gets the content its experiment is about.

## AQA Psychology

`aqa_psychology/tag_psychology.py split` writes batches of AQA A-Level (7182) and AS
(7181) Psychology questions to `.work/aqa-psychology/tag/`, and `merge` collects
them. The brief is the one at the top, with these differences:

- `psychology-topics.txt` lists one topic per line: `code | group | title — what
  the specification says under it`. Choose from these codes (`4.1.2`, `4.2.3.2`,
  `4.3.5`), never a group. Research methods is four topics: `4.2.3` the methods
  themselves (experiments, observation, self-report, correlations, content
  analysis, case studies), `4.2.3.1` scientific processes (aims, hypotheses,
  sampling, designs, variables, controls, ethics, reliability, validity, peer review,
  reporting and referencing), `4.2.3.2` data handling and analysis (types of data,
  descriptive statistics, graphs, distributions, calculations) and `4.2.3.3`
  inferential testing (probability, significance, choosing and using a test, Type I
  and II errors).
- Each line is a whole question (rarely a part, "06.1"), with its `paper` ("AS 1",
  "A-Level 3"), the `section` of the paper it sits in ("Section C: Schizophrenia"),
  its `marks`, its words (with any scenario or table printed above it) and the
  start of its scheme (for an essay, what the scheme credits, without the levels table).
- **Paper 3 option sections** (A-Level 3, Sections B, C and D): the first code is
  always that section's option topic (Relationships `4.3.2` … Addiction `4.3.10`),
  whatever the question asks. If it is a research-methods question (a sampling
  method, a statistical test, a referencing convention), add the research-methods
  topic it tests as the second code.
- **Everywhere else**, tag what the question tests. A research-methods question set
  in a topic's section ("identify the experimental design" in Section B: Memory)
  gets its research-methods topic; add the section's topic second only when the
  answer needs knowledge of it too (explaining a memory finding from the data). Paper
  3 Section A is Issues and debates (`4.3.1`). An approaches question on the
  biological approach is `4.2.1`; one on the nervous system, neurons, hormones, the
  brain or biological rhythms is `4.2.2`.

## Edexcel Economics A

`edexcel_economics/tag_economics.py split` writes batches of Pearson Edexcel A-Level
(9EC0) and AS (8EC0) Economics A parts to `.work/edexcel-economics/tag/`, and `merge`
collects them. The brief is the one at the top, with these differences:

- `economics-topics.txt` lists the specification's sub-topics: `code | topic | title
  [AS] or [A-Level only] — what the specification says under it`. Codes have three
  numbers (`1.2.3`, `3.4.4`); choose from these, never a topic like `3.4`.
- Each line has its `paper` ("AS 1", "A-Level 3"). AS papers only test [AS] topics
  (themes 1 and 2). A-Level Paper 1 is mostly themes 1 and 3, Paper 2 themes 2 and 4,
  and Paper 3 can test anything.
- The `setup` is often the start of the extracts the question is set on; judge by
  what the question asks and its scheme, not by the extract's subject (a question on
  the gas industry's price elasticity is `1.2.3`, not an energy topic).
- Multiple-choice questions: `question` holds the stem and options A–D; tag by the
  concept tested (a PED calculation is `1.2.3`).
- Essays and the 15–25 mark questions often span several sub-topics: give the main
  one first and a second only when the scheme's indicative content genuinely needs it
  (an essay on the effects of a minimum wage: `3.6.2` then `3.5.3`).
- Common confusions: externalities `1.3.2` vs government intervention `1.4.1` (a tax
  or regulation to correct an externality is `1.4.1` unless the question is about the
  externality itself); balance of payments in theme 2 (`2.1.4`) for AS and theme 4
  (`4.1.7`) for A-Level questions on causes and correction of imbalances; demand-side
  policy `2.6.2` vs central banks `4.4.3` (the Bank of England's tools and role are
  `4.4.3` on A-Level papers when the question is about the central bank itself).

## Edexcel Geography

`edexcel_geography/tag_geography.py split` writes batches of Pearson Edexcel A-Level
(9GE0) and AS (8GE0) Geography parts to `.work/edexcel-geography/tag/`, and `merge`
collects them. The brief is the one at the top, with these differences:

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

## AQA Geography

`aqa_geography/tag_geography.py split` writes batches of AQA A-Level (7037) and AS
(7036) Geography parts to `.work/aqa-geography/tag/`, and `merge` collects them. The
brief is the one at the top, with these differences:

- `geography-topics.txt` lists one topic per line: `code | area | title — the
  specification's words`. Codes have four numbers (`3.1.3.2`, `3.2.4.4`), except the
  fieldwork area's (`3.3.1`-`3.3.5`, the stages of a fieldwork enquiry, which the
  specification doesn't number); choose from these, never an area like `3.1.3`.
- Each line has its `paper`, its `area`, its `marks`, the part's own `question` (an AS
  multiple-choice part lists its options A-D), its `setup` (the lines above it,
  "Figure 4 shows…") with the insert `figures` it is set on, and the start of its
  `scheme`.
- **Every code must be in the line's `area`**: the area is the question the part is
  printed in, and each option is its own area (deserts `3.1.2`, coasts `3.1.3`,
  glaciers `3.1.4`, hazards `3.1.5`, ecosystems `3.1.6`, urban `3.2.3`, population
  `3.2.4`, resources `3.2.5`), so a student who studies coasts never meets a glaciers
  part. The merge rejects a code from another area. A second code, only when the part
  genuinely needs two topics, comes from the same area.
- Each area's last topics are `Quantitative and qualitative skills` and `Case studies`.
  A part that asks to analyse, interpret or calculate from a figure ("Analyse the data
  shown in Figure 3", the 6-mark AO3 parts) is tagged to the content the data is about
  (rainfall and vegetation change in the Sahara: `3.1.2.4` desertification), with the
  area's skills topic second when the part is mainly a data skill (a mean, a standard
  deviation, a graph to complete). A 20-mark essay "with reference to a <place> you have
  studied" or "a case study of…" is tagged to the content it asks about first, with the
  area's `Case studies` topic second. Changing places' `3.2.2.4 Place studies` is for
  questions on the student's own local or distant place study.
- AS Paper 2 Section B (area `3.3`, questions 02-04) is fieldwork: `3.3.1` planning,
  aims, hypotheses, sampling, risk and ethics, choosing a site; `3.3.2` collecting
  primary and secondary data (questionnaires, interviews, census data, measurements);
  `3.3.3` presenting data (maps, graphs, completing a figure); `3.3.4` analysing data
  and statistics (median, interquartile range, standard deviation, Spearman's rank,
  significance); `3.3.5` conclusions, evaluating reliability and the enquiry, and how
  it could be developed. The scenario (a town survey, a peat depth study) doesn't
  matter: tag the stage of the enquiry the part asks about.

## AQA Business

`aqa_business/tag_business.py split` writes batches of AQA A-Level (7132) and AS (7131)
Business questions to `.work/aqa-business/tag/`, and `merge` collects them. The brief
is the one at the top, with these differences:

- `business-topics.txt` lists the specification's topics: `code | area | title [AS] or
  [A-Level only] — what the specification says under it`. Codes have three numbers
  (`3.5.2`, `3.10.1`); choose from these, never an area like `3.5`.
- Each line has its `paper` ("AS 1", "A-Level 3"), `label` and `marks`. AS papers only
  test the [AS] topics (3.1 to 3.6). On A-Level papers prefer the A-Level topic where
  one fits: interest rates, exchange rates or the economy are `3.7.5` there, but `3.1.3`
  on an AS paper.
- `question` is the question's own words first, then its case study or shared data (cut
  short). Judge by what the question asks and its scheme ("The demands of the question
  are…"), not by the case's subject. Multiple-choice questions carry their answer as
  `scheme` ("Answer: B").
- Essays and 16- to 25-mark questions often span topics: give the main one first and a
  second only when the question genuinely needs it ("financial or non-financial
  motivation to raise labour productivity" is `3.6.4`; "is innovation essential to
  differentiation" is `3.8.2` then `3.9.2`).
- Where things live: decision trees and expected values `3.2.2`; stakeholder mapping
  `3.2.3`; leadership styles `3.2.1`; market research, sampling, elasticity, correlation
  and marketing data `3.3.2`; segmentation and market mapping `3.3.3`; the 7Ps, pricing,
  product life cycle and Boston matrix `3.3.4`; capacity utilisation, unit costs and
  operations data `3.4.2`; lean production, technology and efficiency `3.4.3`; quality
  `3.4.4`; inventory, JIT, suppliers and outsourcing `3.4.5`; profit and profit margins
  `3.5.1`; budgets, variances, cash-flow forecasts, break-even, contribution and margin
  of safety `3.5.2`; sources of finance and debt factoring `3.5.3`; improving cash flow
  or profit `3.5.4`; hard and soft HRM, HR objectives `3.6.1`; labour turnover,
  retention and HR data `3.6.2`; structure, spans of control, delayering, centralisation,
  workforce planning `3.6.3`; motivation theories and methods `3.6.4`; trade unions,
  works councils, employee involvement `3.6.5`; mission, objectives and SWOT `3.7.1`;
  financial ratios (current ratio, gearing, ROCE, payables/receivables days, inventory
  turnover) `3.7.2`; non-financial performance, the balanced scorecard and Elkington's
  Triple Bottom Line `3.7.3`; legislation and government policy `3.7.4`; the economy,
  interest and exchange rates, globalisation's economic side `3.7.5`; CSR, ethics and
  social or technological change `3.7.6`; Porter's five forces `3.7.7`; payback, ARR
  and NPV `3.7.8`; Ansoff `3.8.1`; Porter's generic strategies and Bowman's strategic
  clock `3.8.2`; growth, mergers and takeovers, economies of scale, franchising,
  retrenchment `3.9.1`; innovation, R&D, kaizen `3.9.2`; international markets,
  offshoring and reshoring `3.9.3`; digital technology, e-commerce, big data `3.9.4`;
  change, resistance, Lewin, Kotter and Schlesinger, flexible organisations `3.10.1`;
  organisational culture, Handy, Hofstede `3.10.2`; implementing strategy, network
  analysis and the critical path `3.10.3`; strategic drift, planned v emergent strategy,
  why strategies fail `3.10.4`. A ratio or appraisal on an AS paper takes the [AS]
  topic it sits in (a profit margin `3.5.1`, labour productivity `3.6.2` or `3.4.2`).

## AQA Economics

`aqa_economics/tag_economics.py split` writes batches of AQA A-Level (7136) and AS
(7135) Economics questions to `.work/aqa-economics/tag/`, and `merge` collects them.
The brief is the one at the top, with these differences:

- `economics-topics.txt` lists the A-Level specification's sub-topics: `code | topic |
  title [AS] or [A-Level only] — what the specification says under it`. Codes have
  four numbers (`4.1.3.2`, `4.2.6.4`); choose from these, never a topic like `4.1.3`.
  AS papers use the same codes (the AS content is the [AS] sub-topics).
- Each line has its `paper` ("AS 1", "A-Level 3"). Paper 1 (AS and A-Level) is
  microeconomics (`4.1`), Paper 2 macroeconomics (`4.2`); A-Level Paper 3 can test
  anything. AS papers only test [AS] sub-topics.
- `question` is the question's own words first, then the extracts of the context it
  is set on (cut short). Judge by what the question asks and its scheme, not by the
  extract's subject: a calculation of a percentage change from a table is `4.2.1.3`
  (index numbers) only when it is about index numbers; otherwise tag the concept the
  data is used for, or `4.1.1.1` for a plain data calculation in a micro context.
- Multiple-choice questions carry their answer as `scheme` ("Answer: B"); tag by the
  concept tested.
- The 15- and 25-mark questions and essays often span several sub-topics: give the
  main one first and a second only when the question genuinely needs it.
- Common confusions: externalities `4.1.8.4` vs government intervention `4.1.8.9` (a
  tax or regulation to correct a market failure is `4.1.8.9` unless the question is
  about the failure itself); monetary policy and the Bank of England `4.2.4.3`;
  fiscal policy `4.2.5.1`; the balance of payments `4.2.6.3`; exchange rates `4.2.6.4`;
  inequality and poverty `4.1.7.x`; labour markets `4.1.6.x`.

## AQA Philosophy

`aqa_philosophy/tag_philosophy.py split` writes the AQA A-Level Philosophy (7172)
questions to `.work/aqa-philosophy/tag/` (one batch: 120 questions), and `merge` collects
them. The brief is the one at the top, with these differences:

- `philosophy-topics.txt` lists one topic per line: `code | area | title — what the
  specification says under it`. Codes have three or four numbers (`3.1.4`, `3.3.2.1`);
  choose from these, never an area like `3.3`.
- Each line is a whole question with its `area` (questions 01–05 are the paper's first
  area, 06–10 its second: Paper 1 Epistemology then Moral philosophy, Paper 2 Metaphysics
  of God then Metaphysics of mind), its `marks`, its words and the start of its scheme's
  indicative content. Tag within the line's area.
- Tag the theory or argument the question is about: "Explain Hume's design argument" is
  `3.3.2.2`; a question on a criticism of a theory is that theory's topic ("the
  asymmetry of self-knowledge is a problem for behaviourism" is `3.4.3.1`). Interactionist
  and epiphenomenalist dualism and their issues (the problem of other minds, interaction,
  self-knowledge, evolution) are `3.4.2.3` Issues facing dualism.
- Terms from the course's opening (analytic/synthetic, a priori/a posteriori,
  necessary/contingent) are `3.1.3.2`, the intuition and deduction thesis, as is Hume's
  Fork; necessary and sufficient conditions are `3.1.1`. Ayer's verification principle on
  Paper 1 is moral anti-realism (`3.2.3.2`), on Paper 2 religious language (`3.3.3`).
  Applying a theory to stealing, simulated killing, eating animals or lying is `3.2.2`
  then the theory's code.
- An essay weighing two theories against each other in equal measure (moral realism
  against anti-realism, substance against property dualism) gets both; otherwise one.

## Cambridge International (CAIE)

`caie/tag_caie.py split` writes batches for CAIE AS & A Level Biology 9700,
Chemistry 9701 and Physics 9702 to `.work/caie-sciences/tag/`, and with
`.work/caie-maths` for Mathematics 9709 and Further Mathematics 9231; `merge`
collects them. The brief is the one at the top, with these differences:

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

## Eduqas sciences

`eduqas/tag_eduqas.py split` writes batches for Eduqas's A-Level Physics (A420, and AS
B420), Chemistry (A410, B410) and Biology (A400, B400) to `.work/eduqas-sciences/tag/`,
and `merge` collects them. The brief is the one at the top, with these differences:

- `<subject>-topics.txt` lists one topic per line: `code | component | title [AS],
  [A-Level only] or [A-Level option] — what the specification says under it`. Choose
  from these codes. Physics and Biology number topics within their components (`1.2`
  Kinematics, `3.10` Electromagnetic induction) with Component 3's options as `3.A` to
  `3.D`; Biology's Core Concepts, assessed in every paper, are `C.1` to `C.5`. Chemistry
  prints its own codes (`C1.3`, `PI2.2`, `OA3.1`, and `PI3` and `OA4`, which have no
  sub-topics).
- Each line has a `paper` ("AS 1: Motion, Energy and Matter", "A-Level 3: Light, Nuclei
  and Options"). AS papers only take [AS] topics; merge drops any other. A-Level papers
  are synoptic: tag what the part tests, whichever component's topic that is (a
  Component 1 question needing Kinetic theory and Thermal physics gets those, and a
  Component 3 question on capacitors gets `2.4`).
- Component 3's option questions (Physics Section B, Biology Section B) get their
  option's code, plus a second code only where the part plainly tests core content too.
- Physics Component 1 ends with a comprehension (Section B) on an article printed in the
  question: tag what each part asks the student to do with physics, not the article's
  subject in general. Chemistry Component 3 (Chemistry in Practice) and practical parts
  anywhere get the content topic their experiment is about.
- In Biology, the Core Concepts (biological compounds, cells, membranes, enzymes,
  nucleic acids) come up everywhere: use a `C.` code when the marks are for that core
  knowledge, and the component topic when they are for the topic's own content.

## WJEC

`wjec/tag_wjec.py split` writes batches for WJEC's AS/A Level Biology, Chemistry and
Physics (part by part) and Mathematics (a whole question at a time) to
`.work/wjec/tag/`, and `merge` collects them. The brief is the one at the top, with
these differences:

- `<subject>-topics.txt` lists one topic per line: `code | unit | title [AS], [A2] or
  [A2 option] — the specification's learning outcomes`. WJEC sets its content out by
  unit, and the codes are the unit and the topic's number in it (`1.2 Kinematics`,
  `3.5 Nuclear decay`); choose from these.
- Each line has a `paper` ("AS Unit 1", "A2 Unit 4"). An AS unit's paper only tests its
  own unit's topics (a Unit 2 part takes a `2.x` code); the A2 papers (Units 3 and 4)
  mostly test their own unit, but can draw on the AS units (a Unit 3 question on
  energy may need `1.4`).
- Unit 4's options (Physics A–D, Biology A–C) aren't in the batches: merge tags every
  part of an option to that option's code (`4.B`).
- Practical skills and maths skills questions get the content topic they sit in.
- Business (`business-topics.txt`, its own work dir `.work/wjec-business`): AS Unit 1's
  topics are `1.x`; AS Unit 2's four areas are sections of their own, so its topics are
  `2.1.x` Marketing, `2.2.x` Finance, `2.3.x` People in organisations and `2.4.x` Operations
  management (a Unit 2 part takes a `2.x.y` code). Units 3 and 4 are synoptic: a question
  on a case often tests AS content (a Unit 3 cash flow question is `2.2.3`), so tag what the
  marks are for, not the unit. Unit 4's PEST and ethical, legal and environmental factors are
  a topic each (`4.4 Economic factors`); an essay that weighs several takes the two it
  leans on most. Each line's `setup` is the start of the case the part is set on.
- Criminology (the Level 3 Applied Diploma, `criminology-topics.txt`, its own work dir
  `.work/wjec-criminology`): the topics are the assessment criteria of the two examined
  units, coded unit, learning outcome, criterion: `2.2.1` is Unit 2's AC2.1 (biological
  theories), `4.3.3` Unit 4's AC3.3 (limitations of agencies). A part's `paper` ("Unit 2",
  "Unit 4") only takes its own unit's codes. Tag by the command word and what the marks are
  for: "describe one sociological theory" is `2.2.3`, "analyse how the theory applies to
  Barbara" `2.3.1`, "evaluate the effectiveness of …theories" `2.3.2`, "how theories have
  informed policy" `2.4.1`; in Unit 4, "the role/aims/funding/reach of the police" is `4.3.1`,
  "tactics and measures" `4.3.2`, "limitations/weaknesses" `4.3.3`, "evaluate the
  effectiveness" `4.3.4`, and the court system's personnel and agencies' relationships
  `4.1.2`. 2017–2019's schemes print each part's learning outcome (`LO3`) in the margin, a
  check on the criterion's first two digits.
- Maths uses the Edexcel maths topics (`maths-topics.txt`, as the OCR maths banks do):
  one to three codes per question, the main one first. AS Unit 1 and A2 Unit 3 are
  pure maths; AS Unit 2 and A2 Unit 4 are statistics (Section A) and mechanics
  (Section B).

## Practical questions

`practicals.py split` writes the science banks' likely practical questions (any
part whose question or scheme mentions apparatus, a method, variables, uncertainty,
safety or a lab technique) to `.work/practicals/batch-NN.jsonl`. A reader judges every
line and writes `batch-NN.answers.json`, `{"<id>": true or false}` for every id;
`practicals.py merge` turns the yeses into each bank's `practicals.json`, which the
bank's "Practicals" filter reads.

Each line has the `course`, the `paper`, the part's `question` (the start of its
whole question, then the part's own words) and the start of its `scheme`. Answer
**true** when answering the part draws on doing practical work:

- planning or describing a method or procedure, or what to do and in what order;
- choosing or using apparatus, instruments or a lab technique (titration,
  chromatography, aseptic technique, quadrats, a colorimeter, a data logger…);
- variables: identifying the independent, dependent or control variables, keeping
  something constant, or why a control is used;
- taking measurements and their quality: readings, resolution, precision, accuracy,
  repeatability, uncertainty and percentage error, anomalies, systematic and random
  errors, zero errors, parallax;
- evaluating or improving an experiment, or explaining why a step is done;
- safety: hazards, risks and precautions in an experiment;
- processing or interpreting the results of an experiment the question describes,
  when it is a required, core or PAG practical (an AQA GCSE scheme's "RPA" reference
  says so), or when the part asks about the experiment's results as an experiment
  (drawing its graph, finding a gradient from its readings, a conclusion and how
  far its data supports it).

Answer **false** when the practical words are incidental: a reagent and conditions
for a synthesis step, a calculation from data that merely came from an experiment,
recall of theory, "error carried forward" in a scheme, a mass spectrometer or an
instrument as a topic of theory rather than something the student uses, or a
multiple-choice option that happens to name apparatus. Judge by what a student must
do to earn the marks; when it is genuinely half and half, answer true.

### Cambridge IGCSE

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

## AQA A-Level Maths

`aqa_maths/tag_maths.py split` writes batches for AQA A-Level Mathematics 7357 to
`.work/aqa-maths/tag/`, and `merge` collects them. The brief is the one at the top,
with these differences:

- Maths is tagged a whole question at a time, as the other maths banks are: one to
  three codes, the main one first (the topic most of the marks are for).
- `maths-topics.txt` lists one topic per line: `code | section | title — the
  specification's statements (B1, B2, ...)`. Codes are the specification's letters,
  `A` (Proof) to `S` (Moments); choose from these, never a statement like `B3`.
- Each line has a `paper`: Paper 1 is all pure (A-J); Papers 2 and 3 are pure in
  Section A, then Mechanics (P-S) in Paper 2's Section B and Statistics (K-O) in
  Paper 3's. A Section B question takes a pure code only when some of its marks are
  for pure maths (solving the differential equation in a kinematics question takes
  `H` after `Q`).

## Computer Science (OCR and AQA)

`computer_science/tag_cs.py split` writes batches for OCR A-Level Computer Science
(H446, AS H046) to `.work/ocr-cs/tag/` and AQA's (7517, AS 7516) to
`.work/aqa-cs/tag/`, and `merge` collects them. The brief is the one at the top, with
these differences:

- `cs-topics.txt` lists one topic per line: `code | section | title [AS or A-Level
  only] — what the specification says under it`. OCR's codes have three numbers
  (`1.4.2 Data structures`, `2.3.1 Algorithms`), AQA's too (`4.2.6 Hash tables`,
  `4.10.4 Structured Query Language (SQL)`); choose from these, never a section.
- Each line has a `paper` ("AS 1", "A-Level 2"). AS papers are tagged with the A-Level
  topic codes; they only test topics marked [AS]. OCR's AS Paper 2 numbers software
  development 2.2.2: it is `1.2.3` here.
- Writing, tracing or correcting code is tagged to what the code is for when the part
  is about that (a bubble sort: OCR `2.3.1`, AQA `4.3.5`; a stack: OCR `1.4.2`, AQA
  `4.2.3`), and to programming itself when it is about the language's constructs
  (OCR `2.2.1`, AQA `4.1.1`): a part asking for a while loop in place of a for loop is
  programming, whatever the loop does.
- AQA Paper 1's programming task ("Write a program that…", with its program source
  code and screen capture parts) is `4.1.1`, with a second code only where the task is
  plainly about one algorithm or structure.

## AQA Sociology

`aqa_sociology/tag_sociology.py split` writes batches of AQA A-Level (7192) and AS
(7191) Sociology questions to `.work/aqa-sociology/tag/`, and `merge` collects them.
The brief is the one at the top, with these differences:

- `sociology-topics.txt` lists one topic per line: `code | area | title — the
  specification's bullet point`. The specification doesn't number its bullet points:
  the codes number them in order under their area (`4.2.2.4` is Families and
  Households' fourth, childhood). Choose from these codes, never an area like `4.2.2`;
  `4.1.2` (Methods in context) is the one topic that is its area's only one.
- Each line is a whole question with its `paper`, its `area`, its `marks`, its own
  words, its `item` (the passage it is set on, where it has one) and the start of
  its `scheme`. Judge by what the question asks and what the scheme credits, not by
  the Item's subject.
- **The first code must be in the line's `area`**: the area is the option or section
  the question is printed in (an option question in "4.2.2 Families and Households"
  is always tagged to a Families topic, whatever it touches on). The merge rejects a
  first code from another area. A second code, only when the question genuinely needs
  two topics, must be in the same area, with one exception below.
- **Methods in Context** (area `4.1.2`, A-Level Paper 1 question 05 and AS Paper 1
  question 06, "evaluate the strengths and limitations of using <method> to
  investigate <issue in education>"): first `4.1.2`, then the Theory and Methods topic
  the method turns on, usually `4.1.3.2` (sources of data), or the Education topic
  the issue is, whichever is more useful to a student revising it. Prefer the method.
- **Theory and Methods** (area `4.1.3`: A-Level Paper 1 question 06, Paper 3 questions
  05-06, AS Paper 2 Section A): `4.1.3.1` research design and quantitative/qualitative
  methods; `4.1.3.2` a particular source of data (questionnaires, interviews,
  observation, experiments, documents, official statistics); `4.1.3.3` primary vs
  secondary data; `4.1.3.4` positivism and interpretivism; `4.1.3.5` theoretical,
  practical and ethical factors in choosing a topic or method; `4.1.3.6`
  functionalism, Marxism, feminism, interactionism, structure and action; `4.1.3.7`
  modernity and postmodernity, globalisation in theory; `4.1.3.8` is sociology a
  science; `4.1.3.9` how theory shapes methods; `4.1.3.10` values, objectivity;
  `4.1.3.11` sociology and social policy.
- Common calls: in Education, social class, gender or ethnic differences in
  achievement are `4.1.1.2` even when the cause named is inside school (labelling,
  subcultures), unless the question is about the school process itself ("pupil
  subcultures", "the hidden curriculum": `4.1.1.3`); marketisation, selection,
  academies and globalisation's effect on policy are `4.1.1.4`; Marxist or functionalist
  views of the role of education are `4.1.1.1`. In Crime and Deviance, a theory of why
  crime happens (functionalist, Marxist, labelling, realist) or of social control is
  `4.3.1.1`; patterns by class, gender or ethnicity `4.3.1.2`; globalisation, the
  media, green and state crime `4.3.1.3`; punishment, policing, surveillance, victims
  and prevention `4.3.1.4`.

## Edexcel Psychology

`edexcel_psychology/tag_psychology.py split` writes Pearson Edexcel's A-Level (9PS0) and AS
(8PS0) Psychology parts to `.work/edexcel-psychology/tag/batch-NN.jsonl`, and `merge`
collects `batch-NN.answers.json` (`{"<id>": ["1.3"], ...}`, one or two codes, the main
one first). The brief is the one at the top, with these differences:

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

## Year 12 or Year 13 (A-Level Maths)

`maths_years.py split` writes every question from the full A-Level Maths papers (Edexcel
9MA0, OCR H240, OCR MEI H640, AQA 7357) to `.work/maths-years/batch-NN.jsonl`, each
with its `course`, `paper` and `text` (the question, then its mark scheme). A reader
judges every line and writes `batch-NN.answers.json`, `{"<id>": 12 or 13}` for every id;
`maths_years.py merge` turns the 13s into each bank's `year13.json`, which the bank's
"Year" filter reads. A Year 12 student is part-way through the course, and wants the
questions they can already do.

Answer **12** when a student who has learnt only the AS content (the first year) could
answer **every part** of the question. Answer **13** when any part needs second-year
content. Judge from what the question and its scheme actually need, not from the
paper it's on: full A-Level papers have plenty of questions that only need AS content.
If a part could be done either way, take the method the scheme expects; when it's a
real toss-up, answer 13 (a Year 12 student stuck on a question is the worse mistake).

**Second-year content (any of it makes a question 13):**
- **Proof:** proof by contradiction.
- **Algebra and functions:** partial fractions; the modulus function and its graphs;
  composite and inverse functions (fg(x), f⁻¹(x)), domain and range of them; combinations
  of graph transformations.
- **Coordinate geometry:** parametric equations (sketching, converting to Cartesian,
  modelling).
- **Sequences and series:** arithmetic and geometric sequences and series, sums to
  infinity, sigma notation, recurrence relations, increasing/decreasing/periodic
  sequences; the binomial expansion of (a + bx)ⁿ for negative or fractional n, and its
  validity.
- **Trigonometry:** radians (arc length, sector and segment area); small-angle
  approximations; sec, cosec, cot and arcsin, arccos, arctan, and their graphs;
  sec²θ = 1 + tan²θ, cosec²θ = 1 + cot²θ; compound- and double-angle formulae;
  R cos(θ ± α) or R sin(θ ± α); proving identities and solving equations with these.
- **Exponentials and logarithms:** nothing beyond AS, except in a calculus context
  below (differentiating or integrating them).
- **Differentiation:** differentiating sin x, cos x, tan x and the others; eˣ, aˣ and
  ln x with the chain, product or quotient rule; implicit and parametric
  differentiation; points of inflection, concave and convex; connected rates of change.
  (AS covers differentiating polynomials and xⁿ, tangents, normals, stationary points,
  increasing/decreasing, and the gradient of e^(kx) as k·e^(kx).)
- **Integration:** integrating eˣ, 1/x, sin x, cos x and others beyond xⁿ; integration
  by substitution and by parts; using partial fractions; area between a curve and a line
  or two curves; the area under a parametric curve; integration as the limit of a sum;
  separable differential equations and their modelling.
- **Numerical methods:** locating roots by sign change, iteration xₙ₊₁ = g(xₙ),
  Newton–Raphson, the trapezium rule.
- **Vectors:** vectors in three dimensions.
- **Statistics:** conditional probability, including from Venn diagrams and tree
  diagrams with set notation; the normal distribution (and using it to approximate a
  binomial); hypothesis tests for a correlation coefficient and for the mean of a normal
  distribution; regression with exponential models (y = ab^x, y = axⁿ via logs) is
  13 when it needs the logs of both variables in a statistics context.
- **Mechanics:** moments; resolving forces in two dimensions and on inclined planes;
  friction (F ≤ μR); projectiles; motion in two dimensions with vectors, including
  variable acceleration with calculus in 2D.

**First-year (AS) content, for comparison:** proof by deduction, exhaustion and
counter-example; surds and indices; quadratics, the discriminant, inequalities;
polynomials and the factor theorem; graphs and simple transformations; straight lines
and circles; the binomial expansion for positive whole n; sine and cosine rules, area
½ab sin C, trig graphs, tan θ = sin θ/cos θ, sin² + cos² = 1, solving trig equations in
degrees; exponentials and logs, laws of logs, e^x and ln x, exponential models and
linearising with logs; differentiation from first principles, of xⁿ and polynomials,
tangents, normals, stationary points; integration of xⁿ, definite integrals, area under
a curve; 2D vectors; sampling, data presentation and interpretation, correlation,
probability (mutually exclusive, independent), the binomial distribution, a binomial
hypothesis test; kinematics in one dimension (suvat, graphs, variable acceleration
with calculus), Newton's laws in one dimension, connected particles and pulleys.

The rest of the A-Level Maths banks need no reader: every AS paper question is 12, and
WJEC's A2 units (Units 3 and 4) and Cambridge's Papers 3 and 6 test only second-year
content, so all theirs are 13.

## Year 12 or Year 13 (A-Level Further Maths)

`maths_years.py split-further` writes every question from the full A-Level Further Maths
papers (Pearson 9FM0, OCR Y540-Y545, OCR MEI Y420-Y436) to
`.work/fm-years/batch-NN.jsonl`, one board per batch, each line with its `course`,
`paper`, `text` (the question, then its mark scheme) and `as_spec`, that board's AS
Further Maths specification as text. A reader writes `batch-NN.answers.json`,
`{"<id>": 12 or 13}`; `merge-further` turns the 13s into each bank's `year13.json`.

A Further Maths student in Year 12 has studied the **AS Further Maths** content of their
board (its AS core pure, and the AS version of the options) alongside **Year 12 Maths**
(the AS Maths content; see "Year 12 or Year 13 (A-Level Maths)" above).

Answer **12** when that student could answer **every part**: the question uses only
content in the board's AS Further Maths specification (core pure, plus the AS paper of
the same option: a Further Statistics question against AS Further Statistics / Statistics,
a Mechanics question against AS Mechanics, a Decision / Discrete / Modelling with
Algorithms question against its AS version, Additional or Extra Pure against its AS
version), and only Year 12 Maths beyond it. Answer **13** when any part needs content
the AS specification doesn't have (in core pure, typically: de Moivre's theorem and the
exponential form beyond what the AS covers, roots of unity, the method of differences,
Maclaurin series, improper integrals, polar coordinates, hyperbolic functions, differential
equations, the mean value of a function, integration with partial fractions or inverse
trig/hyperbolic results), or Year 2 Maths (the chain, product or quotient rule, integration
by parts or substitution, radians in calculus, and the rest of that list above). Check the
`as_spec` file for what the AS covers: boards differ, and an option's AS paper covers less
than its A-Level paper at OCR and MEI. When it's a real toss-up, answer 13.

## GCSE Maths (AQA, Edexcel and OCR Higher)

`gcse_maths/tag_gcse_maths.py split` writes batches for the three GCSE Maths Higher
banks together (AQA 8300, Pearson Edexcel 1MA1, OCR J560) to `.work/gcse-maths/tag/`,
and `merge` collects them into each board's `tags.json`. The brief is the one at the
top, with these differences:

- Maths is tagged a whole question at a time, as the other maths banks are: one to
  three codes, the main one first (the topic most of the marks are for).
- `gcse-maths-topics.txt` lists the DfE subject content every board teaches, one
  statement per line: `code | area | title — what the specification says`. Codes run
  `N1`-`N16`, `A1`-`A25`, `R1`-`R16`, `G1`-`G25`, `P1`-`P9`, `S1`-`S6`; choose from
  these. OCR numbers its own sections differently but covers the same statements, so
  its questions take the same codes.
- Each line has a `paper` saying whether a calculator is allowed, its `marks`, the
  question's words (`question`, as the PDF's text layer gives them: fractions, powers
  and roots can come out jumbled), the start of its `scheme`, and `image`, the path of
  the question's crop. Look at the image whenever the words don't make the question
  clear (a graph or diagram question, or garbled algebra).
- Tag what is being tested, not the context: a percentage change worked out from a
  bank balance is `R9`, compound interest `R16`; Pythagoras or trigonometry in a 3D
  shape is `G20`; finding a missing angle from parallel lines is `G3`, with `G10`
  only when a circle theorem is used. Proof questions take the content they prove
  (`A6` for algebraic proof, `G6` or `G10` for geometric).

## OCR Economics

`ocr_economics/tag_ocr_economics.py split` writes batches of OCR A-Level (H460) and AS
(H060) Economics parts to `.work/ocr-economics/tag/`, and `merge` collects them. The
brief is the one at the top, with these differences:

- `economics-topics.txt` lists the specification's topics: `code | section | number and
  title [AS] or [A-Level only] — what students should be able to do`. The specification
  numbers each component afresh (Microeconomics 2.6 Elasticity, Macroeconomics 2.6 Trends
  in macroeconomic indicators), so the codes put the component first: `1.2.6` is
  Microeconomics 2.6, `2.2.6` Macroeconomics 2.6. Choose from these codes, never a section
  like `1.2`. AS questions take the A-Level's codes (the AS specification numbers the same
  topics differently).
- Each line has its `paper` ("AS 1", "A-Level 3") and `marks`. Paper 1 (and AS 1) is
  microeconomics, codes `1.x.x`; Paper 2 (and AS 2) macroeconomics, `2.x.x`; A-Level
  Paper 3 is synoptic and can test either. AS papers only test [AS] topics.
- The `setup` is the start of the stimulus material or extracts the question is set on;
  tag by what the question asks and its scheme, not by the extract's subject (a question
  on house prices that asks for a percentage change is about the market it describes, and
  a calculation of PED is `1.2.6`).
- Multiple-choice questions (A-Level Paper 3 1–30, AS 1–15): `question` holds the stem
  and options A–D, `scheme` the key and OCR's rationale; tag the concept tested.
- The 25-mark essays (Sections B and C) and the 10–15 mark evaluations often span
  topics: give the main one first and a second only when the scheme's indicative content
  genuinely needs it (monopolistic competition's benefits to consumers: `1.4.3`; a
  minimum price for alcohol: `1.2.11` then `1.2.8`).
- Common confusions: market failure and externalities `1.2.8` vs government
  intervention `1.2.11` (a tax, subsidy, regulation or price control to correct a
  failure is `1.2.11` unless the question is about the failure itself); information
  failure `1.2.9` and public goods `1.2.10` are their own topics; the margin `1.2.7` is
  marginal utility and marginal analysis, not marginal cost in a market structure
  (`1.3.2`); the circular flow and injections/withdrawals `2.1.1` vs the multiplier
  `2.1.5`; the Bank of England's interest rate and QE `2.3.2` vs money, liquidity and
  the banking system `2.5.1`/`2.5.2`; international trade and its benefits `2.4.1`,
  comparative advantage, terms of trade and the Marshall-Lerner condition `2.4.3`,
  protectionism and trade blocs `2.4.4`.
