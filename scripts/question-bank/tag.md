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

## Edexcel Economics B

`edexcel_economics_b/tag_economics_b.py split` writes batches of Pearson Edexcel A-Level
(9EB0) Economics B parts to `.work/edexcel-economics-b/tag/`, and `merge` collects them.
The brief is the one at the top, with these differences:

- `economics-b-topics.txt` lists the specification's sub-topics: `code | topic | title
  — what the specification says under it`. Codes have three numbers (`1.3.1`, `4.4.2`);
  choose from these, never a topic like `1.3`. Economics B has four themes and no AS
  split, so every topic is open to every paper.
- Each line has its `paper` ("A-Level 1"). Paper 1 is drawn from Themes 1 and 4, Paper 2
  from Themes 2 and 3, and Paper 3 (a context announced the year before, then unseen
  extracts) can test anything.
- The `setup` and the start of `question` are often the extracts the question is set
  on; judge by what the part asks and its scheme, not by the extract's subject (a
  question about Tesla's productivity is `2.3.1`, not a topic about cars).
- Themes overlap by design: Theme 4 builds on Theme 1 (competition, market failure,
  government intervention) and Theme 2 on Theme 1 (growth, elasticity, efficiency).
  Tag the topic the scheme's indicative content is mostly about; give a second only for
  a 20-mark essay that genuinely needs it.
- Common confusions: business objectives `1.1.2` vs business objectives and pricing
  decisions `4.1.4`; externalities and market failure `1.5.1` vs `4.3.2`/`4.2.1` (use the
  Theme 4 code when the part is about regulation, society or the spectrum of
  competition, the Theme 1 code when it is about the externality diagram itself);
  government intervention `1.5.2` vs policies to deal with market failure `4.3.3`;
  demand-side `4.4.2` and supply-side policies `4.4.3` (AD/AS and the impact on
  firms) vs policy instruments `2.6.2` (Theme 2: the instruments themselves);
  exchange rates `2.4.4` vs exchange rate changes `3.1.5`.

## Edexcel Business

`edexcel_business/tag_business.py split` writes batches of Pearson Edexcel A-Level (9BS0)
Business parts to `.work/edexcel-business/tag/`, and `merge` collects them. The brief is
the one at the top, with these differences:

- `business-topics.txt` lists the specification's sub-topics: `code | topic | title
  — what the specification says under it`. Codes have three numbers (`1.3.3`, `4.2.5`);
  choose from these, never a topic like `1.3`. There is no AS split.
- Each line has its `paper` ("A-Level 1"). Paper 1 is drawn from Themes 1 and 4, Paper 2
  from Themes 2 and 3, and Paper 3 (a context announced the year before, then unseen
  extracts) from all four: prefer a code from the paper's own themes where one fits.
- `question` is the part's own words, then the extracts it is set on (cut short). Judge
  by what the part asks and its scheme, not by the extract's industry.
- Give a second code only for a 12-, 16- or 20-mark part that genuinely needs two topics
  ("evaluate these two options": tag what the options are, organic growth `3.2.3` against
  a takeover `3.2.2`, say).
- Where things live: market mapping, differentiation and adding value `1.1.3`; elasticity
  calculations `1.2.4` and `1.2.5`; the design mix `1.3.1`; pricing strategies `1.3.3`;
  leadership styles `1.4.5`; private limited companies, franchises and flotation `1.5.4`;
  opportunity cost and trade-offs `1.5.5`; limited liability `2.1.3`; break-even `2.2.3`;
  current and acid test ratios, working capital `2.3.2`; profit margins `2.3.1`; inflation,
  interest and exchange rates for a UK business `2.5.1`; Ansoff and Porter's strategic
  matrix `3.1.2`; PESTLE and Five Forces `3.1.4`; gearing and ROCE `3.5.2`; investment
  appraisal (payback, ARR, NPV) `3.3.2`; decision trees `3.3.3`; critical path `3.3.4`;
  stakeholders against shareholders `3.4.3`; ethics in a UK business `3.4.4`, in a
  multinational `4.4.2`; exchange rates for a business competing abroad `4.2.5`; joint
  ventures and global mergers `4.2.4`; choosing a country to sell in `4.2.2` or to produce
  in `4.2.3`; glocalisation and global marketing strategy `4.3.1`; cultural mistakes
  abroad `4.3.3`.

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

## Edexcel GCSE Geography B

`edexcel_gcse_geography/tag_gcse_geography.py split` writes batches of Pearson Edexcel GCSE
Geography B (1GB0) parts to `.work/edexcel-gcse-geography/tag/`, and `merge` collects them.
The brief is the one at the top, with these differences:

- `geography-b-topics.txt` lists one key idea per line: `code | topic | title — the
  specification's detailed content`. Codes are the specification's numbered key ideas (`1.4`
  tropical cyclones' causes, `2.5` globalisation in the emerging country, `4.6` river
  landscapes); Topic 6's four fieldwork contexts, which the specification doesn't number, are
  `6.1` coasts, `6.2` rivers, `6.3` urban, `6.4` rural.
- **Each line says which codes it may take**: `first` (the key ideas of the topic its question
  is in, fixed by paper and number) and `second`. merge rejects anything else. Give a second
  code only when it adds something.
- Each line has its `paper` and section. Paper 1: Question 1 Hazardous Earth, 2 Development
  dynamics, 3 Challenges of an urbanising world. Paper 2: Section A (Questions 1-4) the UK's
  physical landscape (1 the overview, 2 coasts, 3 rivers, 4 an 8-mark question on either),
  Section B (5-7) the human landscape, Section C1 (8 or 9) physical fieldwork, C2 (10 or 11)
  human fieldwork. Paper 3: Section A (Question 1) People and the biosphere, B (2) Forests
  under threat, C (3) Consuming energy resources, D (4) the 12-mark decision.
- Within a topic, tag the content the part tests, by the scheme: the global circulation and
  climate graphs `1.1`, natural climate change and its evidence `1.2`, human-caused change and
  projections `1.3`; tropical cyclones' characteristics and formation `1.4`, their hazards and
  vulnerability `1.5`, preparation and response `1.6`; Earth's structure and convection `1.7`,
  plate boundaries, volcano and earthquake types `1.8`, impacts and management `1.9`.
  Development indicators and demographic data `2.1`, causes of inequality, Rostow and Frank
  `2.2`, top-down and bottom-up, NGOs, IGOs, TNCs `2.3`; the emerging country case study
  (India, China, Nigeria…) `2.4`-`2.7` by what it asks. World urbanisation trends `3.1`, its
  causes and economic sectors `3.2`, land use change in cities `3.3`; the megacity case study
  (Mumbai, Lagos, Jakarta…) `3.4`-`3.7`. UK geology, relief and climate `4.1`-`4.2`, coastal
  processes and landforms `4.3`, human activity at the coast `4.4`, coastal flooding and
  management `4.5`, river processes and landforms `4.6`, human activity on rivers `4.7`,
  flooding and river management `4.8`. UK population, economy and settlement `5.1`,
  migration, globalisation and the UK economy `5.2`, the UK city case study `5.3`-`5.6`,
  rural areas and the rural-urban fringe `5.7`-`5.8`. Biomes `7.1`, goods and services,
  Malthus and Boserup `7.2`. Rainforest and taiga structure and adaptations `8.1`-`8.2`,
  threats `8.3`-`8.4`, protection `8.5`-`8.6`. Energy types and impacts `9.1`, access and
  use `9.2`, oil supply and demand `9.3`, new oil and gas sources `9.4`, alternatives and
  technology `9.5`, attitudes and energy efficiency `9.6`.
- Skills parts (a graph to complete, a mean, a range, a percentage, a ratio, a map reading)
  get the key idea of the data they are about.
- Fieldwork (Paper 2 Section C): choose the context from the question's own words (a coastal
  investigation `6.1`, river `6.2`, urban `6.3`, rural `6.4`); a second code only when a part
  is mostly about the content (river flooding `4.8`, coastal management `4.5`, quality of life
  in a city `5.5`).
- Paper 3 Question 4 (one part, set on the whole resource booklet): the key idea of Topics 7-9
  its options are mainly about first (protecting a forest `8.5` or `8.6`, an energy future `9.5`),
  and the other one second.

## AQA GCSE Geography

`aqa_gcse_geography/tag_gcse_geography.py split` writes batches of AQA GCSE Geography (8035)
parts to `.work/aqa-gcse-geography/tag/`, and `merge` collects them. The brief is the one at
the top, with these differences:

- `gcse-geography-topics.txt` lists one topic per line: `code | section | title — the
  specification's words`. Codes are the specification's numbered topics (`3.1.1.2 Tectonic
  hazards`, `3.2.3.2 Food`); urban issues (`3.2.1.1`-`3.2.1.4`) and the changing economic
  world (`3.2.2.1`-`3.2.2.4`) are its key ideas, fieldwork (`3.3.2.1`-`3.3.2.6`) the six
  stages of an enquiry, and Geographical skills `3.4.1`-`3.4.4`.
- **Each line says which codes it may take**: `first` (the topics of the question it is
  printed in, fixed by paper and number, so the coasts question never takes a rivers topic)
  and `second`. merge rejects anything else. Give a second code only when it adds something.
- Within an area, tag the content the part tests: in Paper 1's Question 1, plate margins,
  earthquake effects and responses `3.1.1.2`; atmospheric circulation, tropical storms and
  UK extreme weather `3.1.1.3`; climate change evidence, causes and management `3.1.1.4`;
  hazard risk in general `3.1.1.1`. Question 2: a small-scale UK ecosystem, food webs, global
  biomes `3.1.2.1`; rainforests and deforestation `3.1.2.2`; hot deserts and desertification
  `3.1.2.3`; cold environments `3.1.2.4`. Physical landscapes: `3.1.3.1` only for the UK's
  relief, upland and lowland areas; everything else in Questions 3-5 is the landscape's own
  topic. Paper 2 Question 1: world urban trends and megacities `3.2.1.1`; the LIC/NEE city
  case study (Rio, Lagos, Mumbai), slums, urban planning for the urban poor `3.2.1.2`; the UK
  city case study, regeneration, the rural-urban fringe `3.2.1.3`; sustainable cities,
  transport `3.2.1.4`. Question 2: measuring development, the DTM, population pyramids,
  causes of uneven development `3.2.2.1`; aid, trade, debt relief, tourism, intermediate
  technology `3.2.2.2`; the LIC/NEE country case study (Nigeria), TNCs `3.2.2.3`; the UK
  economy, deindustrialisation, science parks, the north-south divide, rural change,
  transport infrastructure `3.2.2.4`.
- A part that is mostly a skill (a grid reference, a distance or direction on an OS map, a
  graph or map to complete, a mean, median, range or percentage) takes its area's content
  topic first and the skill second: `3.4.1` maps, OS maps, grid references, distances, cross
  sections; `3.4.2` graphs and charts to read or complete; `3.4.3` percentages, ratios,
  proportions, calculations; `3.4.4` mean, median, mode, range, interquartile range, quartiles.
- Paper 3 Section A (questions 01-03, issue evaluation, set on the pre-release resources
  booklet) is `3.3.1` first, with the content topic the issue is about second (waste
  incineration: `3.2.3.4` Energy; housing and brownfield sites: `3.2.1.3`; an urban world:
  `3.2.1.1`), or a skill when the part is one.
- Paper 3 Section B (questions 04-05) is fieldwork: tag the stage the part asks about, not
  the scenario. `3.3.2.1` the enquiry question or hypothesis, its theory, risks and how to
  reduce them, choosing a site; `3.3.2.2` collecting data, primary and secondary data,
  sampling, describing or justifying a method; `3.3.2.3` presenting data, completing or
  choosing a graph or map; `3.3.2.4` describing, analysing and explaining results, links
  between data sets, statistics, anomalies; `3.3.2.5` conclusions; `3.3.2.6` evaluating
  methods, data or conclusions, and how the enquiry could be improved. A skill can be second.

## AQA GCSE Business

`aqa_gcse_business/tag_gcse_business.py split` writes batches of AQA GCSE Business (8132)
parts to `.work/aqa-gcse-business/tag/`, and `merge` collects them. The brief is the one at
the top, with these differences:

- `gcse-business-topics.txt` lists one topic per line: `code | area | title — the
  specification's words`. Codes have three numbers (`3.6.2`); never an area like `3.6`.
- **Each line says which codes it may take** (`allowed`): Paper 1 takes 3.1 Business in the
  real world, 3.2 Influences on business, 3.3 Business operations and 3.4 Human resources;
  Paper 2 takes 3.1, 3.2, 3.5 Marketing and 3.6 Finance. merge rejects anything else.
- `question` is the part's own words, `items` the start of the case it is set on. Judge by
  what the part asks and its scheme, not by the business in the items. Multiple-choice parts
  carry their answer as `scheme` ("Answer: B").
- 9- and 12-mark questions often weigh two options: give the topic the decision is about
  first, and a second only when the scheme needs both in equal measure.
- Where things live: enterprise, entrepreneurs, factors of production, opportunity cost,
  business failure `3.1.1`; sole traders, partnerships, ltd and plc, limited liability, not
  for profit `3.1.2`; aims and objectives, measuring success `3.1.3`; stakeholders and their
  conflicts `3.1.4`; location `3.1.5`; business plans `3.1.6`; organic and external growth,
  mergers, takeovers, franchising, economies and diseconomies of scale, going public `3.1.7`;
  e-commerce, digital communication `3.2.1`; ethics, the environment, sustainability, Fair
  Trade `3.2.2`; interest rates, unemployment, consumer income, inflation, the economic cycle
  `3.2.3`; globalisation, exchange rates, imports and exports, multinationals, tariffs and
  trade blocs `3.2.4`; employment, health and safety and consumer law, the minimum wage
  `3.2.5`; competition, market share, uncertainty and risk `3.2.6`; job, batch and flow
  production, automation, productivity `3.3.1`; stock control, JIT and JIC, bar gate charts,
  suppliers, logistics, procurement `3.3.2`; quality control and assurance, TQM `3.3.3`;
  customer service, product knowledge, after-sales `3.3.4`; organisational charts, tall and
  flat structures, spans of control, chains of command, delayering, centralisation,
  communication, contracts (full-time, part-time, zero hours, flexible hours, temporary,
  freelance) `3.4.1`; recruitment, job descriptions and person specifications, internal and
  external recruitment, selection `3.4.2`; financial and non-financial motivation, retention
  `3.4.3`; induction, on-the-job and off-the-job training, appraisal `3.4.4`; customer needs
  and wants `3.5.1`; segmentation `3.5.2`; primary and secondary research, sampling,
  qualitative and quantitative data `3.5.3`; price, product, promotion, place, product life
  cycle, extension strategies, Boston matrix, branding, the marketing mix together `3.5.4`;
  sources of finance, loans, overdrafts, share capital, crowdfunding `3.6.1`; cash flow,
  cash-flow forecasts, net cash flow, opening and closing balances `3.6.2`; revenue, costs,
  profit, interest, break-even, average rate of return, unit costs `3.6.3`; income statements,
  statements of financial position, gross and net profit margins, analysing financial
  performance `3.6.4`. A calculation takes the topic of what it calculates (a closing balance
  `3.6.2`; a break-even output or ARR `3.6.3`; a net profit margin `3.6.4`; a percentage
  change in sales, `3.6.3` on Paper 2, or the topic it measures on Paper 1, a labour turnover
  or productivity figure `3.4.3` or `3.3.1`).

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

## AQA Religious Studies

`aqa_rs/tag_rs.py split` writes AQA's A-Level Religious Studies (7062) parts to
`.work/aqa-rs/tag/`, one batch per area a part can be on: `batch-1A.jsonl` (Paper 1
questions 01–02, Philosophy of religion), `batch-1B.jsonl` (Paper 1 questions 03–04,
Ethics and religion) and `batch-A.jsonl` … `batch-E.jsonl` (Paper 2, Buddhism, Christianity,
Hinduism, Islam, Judaism). `merge` collects them, keeping only codes from the batch's own
topics file. The brief is the one at the top, with these differences:

- `rs-<area>-topics.txt` lists one topic per line: `code | section | title — what the
  specification says under it`. Paper 1's codes are `1A.1` (Arguments for the existence
  of God) to `1B.7` (Bentham and Kant); a religion's are its letter and 1–11 (`B.2` God,
  `D.9` Islam, migration and religious pluralism, `A.10` The dialogue between Buddhism and
  philosophy, `A.11` … and ethics). A Paper 2 batch's file also lists Paper 1's topics.
- Each line is a part: `knowledge` (x.1, "Examine…", 10 marks), `evaluation` (x.2, a
  claim to evaluate, 15 marks) or `dialogue` (Paper 2's 25-mark essays, questions 03–06).
- Paper 1 and Paper 2's two-part questions: one code, the topic the part asks about. A
  theory applied to an issue ("Situation ethics cannot justify blood sports", "Natural
  Moral Law applied to cloning") is the issue's topic (`1B.2` human, `1B.3` animal life
  and death) then `1B.1`; meta-ethical questions on Utilitarianism or Divine Command
  Theory are `1B.4`; reward, punishment and moral responsibility are `1B.5`.
- A dialogue essay always gets two codes: its dialogue (03–04 the religion's `.10`,
  05–06 its `.11`), then the topic it debates, a Paper 1 one where it is one (miracles
  `1A.5`, religious experience `1A.3`, conscience `1B.6`, Bentham or Kant `1B.7`), or
  else the religion's own (sources of authority `.1`, science `.7`, the truth claims of
  other religions `.9`, marriage and sexuality `.6`). So a student revising Miracles finds
  Paper 1's questions and every religion's dialogue essay on it.
- Where the specification puts it, not where it sounds: wealth, materialism and the
  thinkers set against secularisation (Batchelor and Brazier, Roy and Saraswati, Ramadan
  and Ash-Sharabasi) are `.8`; celibacy, marriage, women's ordination and Hampson and
  Ruether are `.6`; war, ahimsa, stewardship and jihad are `.4`; paths of Yoga, puja,
  prayer and worship are `.5`; Maybaum and Rubenstein are `E.9`; concepts of Buddha and
  Anicca are `A.2`.

The 288 parts of November 2020 to June 2025 were tagged on 31 October 2026 by Claude,
following these rules, with the specification's text to hand for each placement.

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

## Eduqas Religious Studies

`eduqas_rs/tag_eduqas_rs.py split` writes Eduqas's A Level (A120) and AS (B120) Religious
Studies parts to `.work/eduqas-rs/tag/`, one batch per area (`batch-A.jsonl` Christianity
… `batch-F.jsonl` Sikhism, `batch-P.jsonl` Philosophy of Religion, `batch-R.jsonl`
Religion and Ethics), and `merge` collects them. The brief is the one at the top, with
these differences:

- `rs-<area>-topics.txt` lists the area's 24 topics, one per line: `code | Theme N: … |
  title [AS] or [A-Level only] — what the specification says under it`. A code is the
  area, the theme and the section's letter (`B.2D`, Islam Theme 2D, Salah). Choose only
  from the batch's own area's file.
- Each line is one essay part: `(a)` asks for knowledge (examine, explain), `(b)` gives a
  quotation to evaluate. A `(b)` line carries its question's `part_a`: the two parts are
  usually on the same section, but a `(b)` can turn to a neighbouring one, so judge `(b)`
  by its own quotation and scheme.
- `report_says` is the examiner's report's own note of what the question tested
  ("Theme 1E: The role of shari'a …"). On an A-Level paper it is the topic code's theme
  and letter. On an AS paper the themes are numbered as the AS specification numbers
  them, which differs from these codes (AS Islam's Theme 3A is the A Level's `B.2D`):
  match it by its title.
- AS papers take only `[AS]` topics; merge drops any other.
- One code nearly always: a second only where the part plainly asks about two sections
  (a comparison of Natural Law with Situation Ethics, say).

## AQA GCSE Religious Studies

`aqa_gcse_rs/tag_gcse_rs.py split` writes AQA's GCSE Religious Studies A (8062) parts to
`.work/aqa-gcse-rs/tag/`, one batch per section, and `merge` collects them. The brief is the one
at the top, with these differences:

- `topics-<section>.txt` lists the section's topics: `code | section | title — what the
  specification says under it`. A part's section is fixed by its paper and question (Component
  1's question 1 is its religion's beliefs and teachings, `CH1`, question 2 its practices, `CH2`;
  2A's questions 1-6 are themes A-F, `TA`-`TF`; 2B's 7 and 8 are St Mark's Gospel, `TG` and
  `TH`), so choose only from the batch's own file.
- A topic is one of the specification's bullet points ("The Trinity", "Pilgrimage: Lourdes and
  Iona", "Just war theory"). The multiple-choice part (`.1`) is the topic its question asks
  about; for "Which one of the following is not an aim of punishment?" that is the aims of
  punishment, not the topic of the odd one out (the scheme's "Answer: A Addiction"). A 12-mark statement to evaluate is the topic the
  statement is about, not every topic an answer might draw on.
- Themes G and H: a question about a passage (the paralysed man, the Transfiguration) is the
  heading the specification lists it under (`TG.1`-`TG.3`, `TH.1`-`TH.3`); a question about what
  Jesus' titles, his miracles or the Kingdom of God mean, or the authority of the Gospel, is the
  "Significance" topic for it.
- One code nearly always: a second only where the part plainly needs two topics.

## Eduqas GCSE Religious Studies and History

`eduqas_gcse/tag_eduqas_gcse.py split rs` (or `history`) writes Eduqas's GCSE Religious Studies
(C120) or History (C100) parts to `.work/eduqas-gcse-<subject>/tag/`, one batch per section of
the specification, and `merge` collects them. The brief is the one at the top, with these
differences:

- `topics-<section>.txt` lists the section's topics: `code | section | title — what the
  specification says under it`. A part's section is fixed by its paper and question (Religious
  Studies' Route A Component 1 question 2 is Theme 2, Issues of Life and Death; History's paper
  is its option, 1G Germany in Transition), so choose only from the batch's own file.
- Religious Studies: a topic is one of the specification's areas of study ("Sexual
  relationships", "The Five Pillars of Sunni Islam"). `(a)` asks what a key concept means: tag
  the area the concept belongs to. Route B's parts can hold two questions, `(i)` and `(ii)`:
  tag both areas when they differ. `report_says`, where there is one, is the 2024 examiner's
  report's own list of what each part tested ("(b) Area of Study: Symbolism; …"): use the line
  for the part's letter.
- History: a topic is one of the option's key questions ("The Black Death"). `sources` is the
  question's stem; judge by the question and the scheme's indicative content, which say what
  period and issue the answer is about. A thematic study's (2E-2H) question 6 is on its
  historic site: always `<option>.site`. A thematic question that spans the whole period
  ("how has the nature of criminal activity changed") is the key question it names.
- One code nearly always: a second only where the part plainly needs two topics.

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

## Edexcel Politics

`edexcel_politics/tag_politics.py split` writes Pearson Edexcel's A-Level (9PL0) and AS (8PL0)
Politics parts to `.work/edexcel-politics/tag/batch-NN.jsonl`, and `merge` collects
`batch-NN.answers.json` (`{"<id>": ["UKP.1"], ...}`, one or two codes, the main one first). The
brief is the one at the top, with these differences:

- `topics.txt` lists the specification's 28 content areas: `UKP.1` Democracy and participation,
  `UKP.2` Political parties, `UKP.3` Electoral systems, `UKP.4` Voting behaviour and the media;
  `CPI.1` Liberalism, `CPI.2` Conservatism, `CPI.3` Socialism; `UKG.1` The constitution, `UKG.2`
  Parliament, `UKG.3` Prime Minister and executive, `UKG.4` Relations between the branches; `NPI.1`
  Anarchism to `NPI.5` Nationalism; `USA.1`–`USA.6` and `GLO.1`–`GLO.6`.
- **Choose only from the line's `sections`**: AS Paper 1 and A-Level Paper 1's Questions 1–2 are
  UK Politics, Paper 1's Question 3 Core Political Ideas; AS Paper 2 and Paper 2's Questions 1–2 UK
  Government, Paper 2's Questions 3–7 Non-core Political Ideas; Paper 3A USA; Paper 3B Global.
- Read the question, not its source: a source question is tagged by the view it asks about.
- Where the specification puts things: rights, pressure groups, think tanks, lobbyists, turnout,
  the franchise and the democratic deficit are `UKP.1`; party funding, manifestos' parties, minor
  parties and party systems `UKP.2`; electoral systems, safe seats, coalitions and **referendums**
  `UKP.3`; elections' outcomes, class and partisan dealignment, the media and opinion polls `UKP.4`.
  Devolution, the rule of law, statute law and constitutional reform are `UKG.1`; the Lords, the
  Commons, backbenchers and select committees `UKG.2`; the PM, Cabinet, ministerial responsibility
  and the Royal Prerogative `UKG.3`; the Supreme Court, judicial review, executive dominance of
  Parliament, the EU and sovereignty `UKG.4`.
- Paper 3's Section A and B questions compare the USA (or the world) with the UK: the US area
  first, then `USA.6` (comparative theories). Paper 3B's Question 2 (realism and liberalism) is
  `GLO.6`. Polarity, hard and soft power, great and emerging powers and state types are `GLO.4`;
  the UN, NATO, IMF, World Bank, WTO, G7/G20 and poverty `GLO.2`; human rights courts, intervention
  and the environment `GLO.3`.

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

## GCSE Maths (AQA, Edexcel and OCR, both tiers)

`gcse_maths/tag_gcse_maths.py split` writes batches for the three GCSE Maths
banks together (AQA 8300, Pearson Edexcel 1MA1, OCR J560) to `.work/gcse-maths/tag/`,
and `merge` collects them into each board's `tags.json`: batches 1 to 31 are the Higher
papers, 32 to 65 the Foundation ones (split leaves out what is already tagged). The brief is the one at the
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

## OCR Law

`ocr_law/tag_ocr_law.py split` writes the OCR A-Level (H418) and AS (H018) Law questions to
`.work/ocr-law/tag/`, and `merge` collects them. The 208 questions of June 2022 to June 2025
were tagged on 29 October 2026 by reading each question and the start of its scheme. The brief
is the one at the top, with these differences:

- `law-topics.txt` lists the specification's topics: `code | section | title [AS], [A-Level
  only] or [Component 3 option] — what is taught and its guidance`. The specification doesn't
  number them, so the codes are the section's (`1A` the legal system, `1B` criminal law, `2A`
  law making, `2B` tort, `3A` the nature of law, `3B` human rights, `3C` contract) and the
  topic's place in it: `1B.3` is Fatal offences against the person. AS questions take the same
  codes.
- Each line has its `paper` ("AS 1", "A-Level 3") and `marks`. Paper 1 is `1A`/`1B`, Paper 2
  `2A`/`2B`; A-Level Paper 3 is `3A` with `3B` (H418/03) or `3C` (H418/04). The AS's "Explain
  the differences between criminal and civil law" is `3A.1`, Introduction to the nature of law,
  which the AS teaches in its legal system.
- The `setup` of an "Advise…" question is its Part's scenarios, two unrelated ones at A-Level:
  tag by what the question asks (the named person's offence, defence or claim), not the other
  scenario.
- Essays ("Discuss…", the starred questions) take the content topic first and the section's
  evaluation topic second (`1B.9`, `2B.8`, `3B.6`, `3C.7`): the intoxication essay is `1B.6`
  then `1B.9`. Section A's 8 and 12 mark "Discuss the advantages…" questions take the content
  topic only.
- Common confusions: loss of control and diminished responsibility are `1B.3` (fatal offences),
  not the general defences; consent, self-defence and duress are `1B.7`, insanity, automatism
  and intoxication `1B.6`; causation, intention and transferred malice `1B.2`; attempts `1B.8`
  (with the offence attempted second); sentencing, appeals and juries `1A.2`; judges `1A.3`;
  ADR, tribunals and the civil tracks `1A.1`; the defences to nuisance and Rylands v Fletcher
  `2B.6` then `2B.4`; a Convention article's scope `3B.3`, but police powers, public order,
  obscenity, harassment, confidentiality and defamation `3B.4`, and judicial review `3B.5`;
  privity and intention to create legal relations `3C.2`, exclusion clauses `3C.3`, liquidated
  damages and penalty clauses `3C.6`.

## OCR Religious Studies

`ocr_rs/tag_ocr_rs.py split` writes the OCR A-Level Religious Studies (H573) questions to
`.work/ocr-rs/tag/`, and `merge` collects them. The 136 questions of November 2021 to June 2025
were tagged on 1 November 2026 by reading each question against the specification's content.
The brief is the one at the top, with these differences:

- `rs-topics.txt` lists the specification's topics: `code | section | title [AS] or [A-Level
  only] — what is taught`. A section is a component (`P` philosophy of religion, `E` religion
  and ethics) or a religion for Developments in religious thought (`C` Christianity, `I` Islam,
  `J` Judaism, `B` Buddhism, `H` Hinduism); the code is the section and the topic's place in it
  (`P5` Religious experience). Choose only from the paper's own section.
- Each line is one 40-mark essay, with its `paper` ("Developments in Islamic thought").
- One code nearly always: a second only where the essay plainly sets two topics against each
  other (utilitarianism applied to sexual ethics is `E9` then `E4`; euthanasia judged by
  situation ethics `E5` then `E2`), the topic the question is about first.
- Placings that aren't obvious from the titles: the Prime Mover and the cave are `P1`; divine
  power and Anselm's four-dimensionalism `P7`; meta-ethics and intuitionism `E7`; whistle-blowing
  `E6`; Rubenstein, Fackenheim and Berkovitz `J11`; Plaskow, Adler and same-sex relationships
  `J10`; the Sunni and Shi'a succession `I2`; maslaha `I10`; 9/11 `I12`; secularism in the
  Muslim world `I11`; the Dalai Lama `B10`; upaya, the paramitas and the arhat and bodhisattva
  paths `B7`; Zen and Pure Land `B9`; Vaishnavism, Shaivism and Shaktism `H1`; the monkey and cat
  analogies `H4`; Neo-Vedanta `H7` with `H8`.

## Edexcel GCSE Computer Science

`edexcel_cs/tag_cs.py split` writes batches of Pearson Edexcel GCSE Computer Science (1CP2)
parts to `.work/edexcel-cs/tag/`, and `merge` collects them. The brief is the one at the top,
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

## AQA Level 2 Further Maths

`aqa_l2_further_maths/tag_l2fm.py split` writes batches for AQA's Level 2 Certificate
in Further Mathematics (8365) to `.work/aqa-l2fm/tag/`, and `merge` collects them into
`.work/aqa-l2fm/tags.json`. The brief is GCSE Maths', with these differences:

- `l2fm-topics.txt` lists the specification's statements, one per line: `code | area |
  title: what the specification says`. Codes run `1.1`-`1.3`, `2.1`-`2.22`, `3.1`-`3.9`,
  `4.1`-`4.9`, `5.1`-`5.4`, `6.1`-`6.10`; choose from these.
- Tag the technique the marks are for, not the setting: a tangent to a curve is `4.4`
  even when the curve is a circle's equation solved for y; the stationary points of a
  cubic are `4.7`, and `4.8` only when they answer a problem in context (a box's
  greatest volume); a matrix question is `5.1` when it is only multiplying, `5.3` or
  `5.4` when it is about the transformation. Solving a trigonometric equation that needs
  an identity first takes `6.10` then `6.9`.
## OCR GCSE Computer Science

`ocr_gcse_cs/tag_ocr_gcse_cs.py split` writes batches of OCR GCSE Computer Science (J277)
parts to `.work/ocr-gcse-cs/tag/`, and `merge` collects them. The brief is the one at the top,
with these differences:

- `cs-topics.txt` lists one topic per line: `code | section | title — the specification's
  words`. The codes are the specification's sub topics (`1.3.2`, `2.1.3`); choose from these,
  never a section like `1.3`. The specification's 1.2.4 Data storage is four topics here:
  `1.2.4a` numbers (binary, hexadecimal, binary addition, overflow, shifts), `1.2.4b`
  characters (character sets, ASCII, Unicode), `1.2.4c` images and `1.2.4d` sound.
- Each line has a `paper`. Paper 1 tests 1.x only, Paper 2 tests 2.x only; merge drops a code
  from the wrong paper.
- A file size or storage capacity calculation is `1.2.3`, unless the part is about what
  changes an image's or a sound's size or quality (`1.2.4c`, `1.2.4d`).
- On Paper 2, writing, completing or correcting a program is `2.1.2` when it is about the
  algorithm (inputs, processes, outputs; trace tables; flowcharts; fixing logic or syntax
  errors), `2.2.1` when it is about the constructs themselves (variables, constants,
  operators, selection, iteration), `2.2.3` for string handling, files, arrays, SQL, sub
  programs and random numbers, and `2.3.1` for validation, authentication and maintainable
  code. A search or sort, traced or written, is `2.1.3`. Add a second code only where the
  part is as much about another of these.
- A truth table or logic diagram is `2.4.1`; test data and test plans `2.3.2`; IDE tools,
  translators and language levels `2.5.1` or `2.5.2`.
## AQA Politics

`aqa_politics/tag_politics.py split` writes the AQA A-Level Politics (7152) questions to
`.work/aqa-politics/tag/`, and `merge` collects them. The brief is the one at the top, with
these differences:

- `politics-topics.txt` lists the specification's 32 topics: `code | section | title — the
  specification's words`. Codes are the specification's own four-part numbers (`3.1.2.2`
  Elections and referendums); choose from these, never a section like `3.1.2`.
- **Choose only from the line's `sections`**: Paper 1 is the UK (`3.1.1` government, `3.1.2`
  politics), Paper 2 the USA (`3.2.1`) and comparative politics (`3.2.2`), Paper 3 the core
  ideologies (`3.3.1`) and the other ideologies (`3.3.2`).
- Each line is a whole question with its `marks`, its own words and the start of its
  scheme's indicative content. Question 04 is set on extracts; tag by what it asks.
- Paper 3 questions name their ideology in a heading after the label ("Socialism"): that
  ideology is the code, alone.
- Paper 2: a question about the USA alone is a `3.2.1` topic. A question comparing the USA
  and the UK (Section A's third question, "structural theory...", and the Section C essays)
  is the matching `3.2.2` topic first (constitutions `3.2.2.1`, executives `3.2.2.2`,
  judiciaries `3.2.2.3`, electoral and party systems `3.2.2.4`, pressure groups `3.2.2.5`,
  civil rights `3.2.2.6`), then the US topic it turns on.
- Paper 1: party funding, ideology and party systems are `3.1.2.3`; electoral systems,
  referendums and voting behaviour `3.1.2.2`; rights, participation and the franchise
  `3.1.2.1`; Brexit and the EU's impact `3.1.2.5`; the Supreme Court and judicial
  independence `3.1.1.4`; the Commons, Lords, backbenchers and select committees `3.1.1.2`.

## AQA Law

`aqa_law/tag_law.py split` writes the AQA A-Level Law (7162) questions to `.work/aqa-law/tag/`,
and `merge` collects them. The brief is the one at the top, with these differences:

- `law-topics.txt` lists the specification's topics: `code | section | title — what is
  taught`. The specification doesn't number them, so the codes are the section's (`NL` the
  nature of law, `LM` law making, `LS` the legal system, `CR` criminal law, `TO` tort, `CO`
  contract, `HR` human rights) and the topic's place in it: `CR.4` is fatal offences.
- **Choose only from the line's `sections`**: every paper sets the nature of law, law making
  and the legal system, with criminal law (Paper 1), tort (Paper 2), contract (Paper 3A) or
  human rights (Paper 3B).
- Questions 01-05 are multiple choice; the scheme's line is the right answer. Tag the topic
  the right answer turns on.
- Problem questions ("Advise...", "Consider the liability of..."): tag by what the scenario
  raises. A 30-mark question that also asks about the legal system or the nature of law
  ("Assess the ways in which Gary may obtain legal advice", "...the role law plays in
  society") takes the substantive topic first and that topic second.
- The 15-mark essays ("Examine what is meant by 'justice'. Discuss the extent to which the
  rules on anticipatory breach achieve justice") take the substantive topic first and the
  nature-of-law topic (`NL.2`-`NL.5`) second. A question on the section's theory ("the
  principles of correspondence and maximum certainty", "fault in tort") is the section's
  theory topic (`CR.2`, `TO.2`, `CO.2`, `HR.2`).
- Common calls: loss of control and diminished responsibility are `CR.4`; consent and
  self-defence `CR.9`, insanity, automatism and intoxication `CR.8`; causation, mens rea and
  omissions `CR.3`; attempts `CR.7`; magistrates, juries, sentencing and appeals `LS.2`;
  barristers, solicitors, legal executives and judges `LS.3`; legal aid and advice `LS.4`;
  ADR and the civil courts `LS.1`; by-laws and statutory instruments `LM.2`; consideration,
  offer and acceptance `CO.3`; frustration and breach `CO.8`; misrepresentation and
  economic duress `CO.7`; police powers, public order and protest are the Convention article
  they engage: the right to life `HR.7` (Article 2, never `HR.6`, which is the Convention as a
  whole), arrest, detention and stop and search `HR.8` (Article 5), privacy `HR.9` (Article 8), speech
  `HR.10` (Article 10), protest `HR.11` (Article 11).
