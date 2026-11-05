# AQA GCSE French, Spanish and Bengali

`aqa_gcse_languages/tag_gcse_languages.py split` writes batches of AQA GCSE French (8658, 8652), Spanish
(8698, 8692) and Bengali (8638) questions to `.work/aqa-gcse-languages/tag/`, and `merge` gives every part its
question's topics. The brief is the one in `tag.md`, with these differences:

- A line is a whole question (`key`, "8658rh-jun24-05"), not a part: one text, recording or writing task, its
  parts asking about it in turn. A writing task's options are lines of their own ("8658wh-jun24-01.2").
- `languages-topics.txt` lists one topic per line: `code | theme | title: what it covers`. Codes are the
  specification's topics and sub-topics (`1.3.4` Sport, `2.4` Travel and tourism); choose from these, never a
  theme like `1` or a topic that has sub-topics like `1.3`.
- Tag what the text or task is about, not the grammar it tests: a text about a school trip abroad is `3.2`, with
  `2.4` second only if the travel matters as much. A writing task's bullet points can span topics: give its main
  one, and up to two more when the bullets clearly ask about them.
- `question` is the question's English instructions and questions, then the text in the language (Section B
  questions are in the language). Bengali texts are left out of `question` (their text layer is unreadable):
  judge a Bengali line by its English title, instructions and questions. Write `[]` only when nothing says
  what the question is about.
- The 2026 specimens (8652, 8692) have new themes; tag them to these topics all the same (celebrity culture is
  `1.3.2` or `1.3.1`, media and technology `1.2.1` or `1.2.2`).
