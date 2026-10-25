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
