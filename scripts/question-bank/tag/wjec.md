# WJEC

`wjec/tag_wjec.py split` writes batches for WJEC's AS/A Level Biology, Chemistry and
Physics (part by part) and Mathematics (a whole question at a time) to
`.work/wjec/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with
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
- Further Maths (`further-topics.txt`, its own work dir `.work/wjec-fm`): a whole question at
  a time, one to three codes, the main one first, from its specification's topics
  (`spec_wjec_further.py`), coded unit and place in the unit: the specification's 2.4.3 is
  `4.3`. AS Units 1 to 3 take only their own codes; an A2 unit also takes the AS unit it builds
  on (Unit 4 `1.x`, Unit 5 `2.x`, Unit 6 `3.x`) where the marks really test it. Keep apart: `1.2`
  basic complex numbers and loci, `4.1` de Moivre and nth roots; `1.3` 2x2 matrices and
  transformations, `4.3` 3x3 and simultaneous equations; `3.1` direct collisions, `6.2` oblique
  ones. Unit 2's specification heading 2.2.1 is three topics here (`2.1` to `2.3`), and 2.2.2 two
  (`2.4`, `2.5`).
