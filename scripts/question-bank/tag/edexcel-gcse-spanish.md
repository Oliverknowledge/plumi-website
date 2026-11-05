# Edexcel GCSE Spanish

`edexcel_gcse_spanish/tag_gcse_spanish.py split` lists Pearson Edexcel's GCSE Spanish (1SP0, and the 1SP1 sample papers) questions in
`.work/edexcel-gcse-spanish/tag/spanish-questions.tsv`, and `merge` gives every part its question's topics. The 478 answers, kept in
`edexcel_gcse_spanish/tags_spanish.json`, were made by hand from each question's printed title and opening words: a title settles most, and a question
printed on both tiers takes one answer. To add a series, add its lines there by these rules, which are the French bank's (`edexcel-gcse-french.md`), since 1SP0 and 1FR0 share
their five themes and 21 topics:

- `spanish-topics.txt` lists the 21 topics, `code | title: what it covers`. Choose from these (`1.3.4` Sport, `2.2` Travel and tourist transactions), never a theme.
- A line is a whole question (`1sp03h-jun24-05`): one text, recording or writing task. A writing task's options are lines of their own (`1sp04h-jun24-01.a`).
- Tag what the text or task is about, not the grammar it tests. One code nearly always, two where a question plainly needs both.
- Where they overlap: a restaurant visit, hotel booking or journey is `2.2`, what people eat `1.2.2`; a festival or celebration `1.3.1`, unless its charity or international reach is the point (`5.1`); a charity, volunteering or helping others `5.1`, volunteering as a career plan `4.2`; a place to live or visit `2.3`, a holiday in it `2.1`; lessons, rules and school life `3.1`, trips, clubs and exchanges `3.2`; plans for later `4.2`, what a job is like or a part-time job `4.3`.
- A literary extract goes by what happens in it (a police inspector's work `4.3`, a boy sent to study in the city `3.1`). A translation goes by its sentences' main topic, as does a Foundation photo.
- 1SP1's sample papers have new themes: tag them to these topics all the same.
