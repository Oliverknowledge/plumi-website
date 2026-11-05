# AQA GCSE Religious Studies

`aqa_gcse_rs/tag_gcse_rs.py split` writes AQA's GCSE Religious Studies A (8062) parts to
`.work/aqa-gcse-rs/tag/`, one batch per section, and `merge` collects them. The brief is the one
in `tag.md`, with these differences:

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
