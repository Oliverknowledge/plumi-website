# Edexcel GCSE Religious Studies

`edexcel_gcse_rs/tag_gcse_rs.py split` writes Pearson Edexcel's GCSE Religious Studies A (1RA0) and B
(1RB0) parts to `.work/edexcel-gcse-rs/tag/`, one batch per section of content, and `merge` collects them.
The brief is the one in `tag.md`, with these differences:

- `topics-<section>.txt` lists the section's eight items: `code | title — what the specification says
  under it`. A part's section is fixed by its paper and question (Question 3 of 1RB0 Paper 2F is Judaism's
  "Living the Jewish Life"), so choose only from the batch's own file, by the code's prefix (`JUPRA.4`).
- A batch line has `id`, `question` (the part's words) and `scheme` (the start of its mark scheme).
- Judge by what the part is about, not by its command words: "Outline three…", "Explain two…" and
  "Evaluate this statement" run through every item. For an evaluate statement, take the item its statement
  is mainly about; the scheme's arguments are the strongest evidence.
- The items overlap on purpose: pilgrimage in general and a named place, the nature of God and the problem
  of evil, the sanctity of life and abortion. Pick the narrowest item that fits.
- One code nearly always: a second only where the part plainly needs two items.
