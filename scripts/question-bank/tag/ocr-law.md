# OCR Law

`ocr_law/tag_ocr_law.py split` writes the OCR A-Level (H418) and AS (H018) Law questions to
`.work/ocr-law/tag/`, and `merge` collects them. The 208 questions of June 2022 to June 2025
were tagged on 29 October 2026 by reading each question and the start of its scheme. The brief
is the one in `tag.md`, with these differences:

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
