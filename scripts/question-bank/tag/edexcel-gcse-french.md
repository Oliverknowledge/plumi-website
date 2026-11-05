# Edexcel GCSE French

`edexcel_gcse_french/tag_gcse_french.py split` lists Pearson Edexcel's GCSE French (1FR0, and the 1FR1 sample papers) questions in
`.work/edexcel-gcse-french/tag/french-questions.tsv`, and `merge` gives every part its question's topics. The 489 answers, kept in
`edexcel_gcse_french/tags_french.json`, were made by hand, as a printed title settles most questions and a question on both tiers takes one answer. To add a series, add its lines there by these rules:

- `french-topics.txt` lists the specification's five themes' 21 topics, `code | title: what it covers`. Choose from these (`1.3.4` Sport, `2.2` Travel and tourist transactions), never a theme.
- A line is a whole question (`1fr03h-jun24-05`): one text, recording or writing task. A writing task's options are lines of their own (`1fr04h-jun24-01.a`), each with its own title.
- Tag what the text or task is about, not the grammar it tests. One code nearly always, two where a question plainly needs both (a fast-food restaurant is `1.2.2` and `2.2`; an international music festival `5.1` and `1.3.3`).
- Where they overlap: a restaurant visit, hotel booking or journey is `2.2`, what people eat `1.2.2`; a festival or celebration `1.3.1`, unless its charity or international reach is the point (`5.1`); a charity, volunteering or helping others `5.1`, volunteering as a career plan `4.2`; a place to live or visit `2.3`, a holiday in it `2.1`; lessons, rules and school life `3.1`, trips, clubs and exchanges `3.2`; plans for later `4.2`, what a job is like or a part-time job `4.3`.
- A literary extract goes by what happens in it: a story of a friendship `1.1.1`, a first day at school `3.1`. A translation goes by its sentences' main topic, as does a Foundation photo.
- 1FR1's sample papers have new themes: tag them to these topics all the same, as the AQA banks do with their 2026 specimens.
