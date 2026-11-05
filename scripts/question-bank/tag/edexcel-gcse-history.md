# Edexcel GCSE History

`edexcel_gcse_history/tag_gcse_history.py split` writes Pearson Edexcel's GCSE History (1HI0)
parts to `.work/edexcel-gcse-history/tag/`, one batch per option (`10`, `P4`, `B1`, `31`), and
`merge` collects them. The brief is the one in `tag.md`, with these differences:

- `topics-<option>.txt` lists the option's topics: `code | option | title — what the specification
  says under it`. A part's option is its paper, so choose only from the batch's own file.
- Paper 2 and Paper 3: a topic is one of the option's key topics ("B1.2 William I in power:
  securing the kingdom, 1066–87"). Judge by the events, people and dates the question names and
  by the scheme's indicative content.
- Paper 1 (options 10 to 13): Section A, questions 1 and 2, is always the historic environment
  (`<option>.site`) and is tagged by the script, not sent out. A Section B question is tagged to
  the period or periods its dates cover ("in the years c1700–c1900" is `.3`; "c1500–c1700 … c1900–
  present" is `.2` and `.4`). One that spans more than two periods ("c1000–present") takes the two
  its stimulus points and indicative content dwell on.
- One code nearly always: a second only where the part plainly needs two topics.
