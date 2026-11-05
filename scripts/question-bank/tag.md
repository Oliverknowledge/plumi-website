# Tagging question parts to spec topics

`tag_batches.py split` writes batches of question parts to `.work/tag/`. Each
batch is tagged by a model reading this brief, and `tag_batches.py merge`
collects the answers into `.work/tags.json` for `build_bank.py`.

The tags were made on 23 October 2026 by Claude subagents, one per few batches,
following exactly the instructions below. To re-tag after a new exam series,
split, tag only the new batches the same way, merge, and rebuild.

This file has the brief every bank shares. A bank's own notes are in `tag/`, in a file per bank: a new bank writes
`tag/<slug>.md`, and doesn't edit this file. Older scripts and notes say `tag.md's "OCR Law" section`: that's
`tag/ocr-law.md`, the section's name in lower case with its brackets dropped.

## Before the bank's PR: its data goes to R2

A bank's data (`public/question-bank/<slug>/`: parts, text, reports, practicals, ...) is no
longer committed; git ignores the folder. Once the bank is built and tagged (and after
practicals.py merge, tiers.py or maths_years.py), upload it and commit the meta:

    python3 scripts/question-bank/upload_data.py <slug>

That writes `"data": {...}` (each file's hash) into `src/content/questionBank/<slug>.json`.
Re-cutting an existing bank in a fresh worktree? `upload_data.py --pull <slug>` first. See
"Bank data on R2" in docs/seo/question-bank.md.

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
papers (Pearson 9FM0, OCR Y540-Y545, OCR MEI Y420-Y436, AQA 7367) to
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
than its A-Level paper at OCR and MEI (and at AQA, whose AS Mechanics has no centres of mass,
whose AS Statistics has no exponential or t-distribution, and whose AS pure stops before
hyperbolic calculus, differential equations and numerical methods). When it's a real toss-up, answer 13.
