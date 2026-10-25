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
