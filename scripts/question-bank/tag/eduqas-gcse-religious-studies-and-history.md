# Eduqas GCSE Religious Studies and History

`eduqas_gcse/tag_eduqas_gcse.py split rs` (or `history`) writes Eduqas's GCSE Religious Studies
(C120) or History (C100) parts to `.work/eduqas-gcse-<subject>/tag/`, one batch per section of
the specification, and `merge` collects them. The brief is the one in `tag.md`, with these
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
