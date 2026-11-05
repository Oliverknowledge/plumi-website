# Eduqas sciences

`eduqas/tag_eduqas.py split` writes batches for Eduqas's A-Level Physics (A420, and AS
B420), Chemistry (A410, B410) and Biology (A400, B400) to `.work/eduqas-sciences/tag/`,
and `merge` collects them. The brief is the one in `tag.md`, with these differences:

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
