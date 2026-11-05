# OCR GCSE Classical Civilisation

`ocr_gcse_classics/tag_ocr_gcse_classics.py split` writes a batch per option of OCR GCSE (9-1)
Classical Civilisation (J199) parts to `.work/ocr-gcse-classics/tag/`, and `merge` collects them.
The brief is the one in `tag.md`, with these differences:

- `classics-topics.txt` lists the specification's key topics, eight per component: `code | component |
  title — what learners study`. Codes are the bank's own: `11.x` Myth and Religion, `12.x` Women in the
  Ancient World, `21.x` The Homeric World, `22.x` Roman City Life, `23.x` War and Warfare. Each line's
  `codes` are the only ones it may take: its own component's.
- Give one code, the topic the part mainly tests, and a second only when its scheme plainly tests another
  topic too (a 15-mark essay comparing two). Each line has its `paper`, `area` ("A Culture", "B Literature",
  "A Greece") and `marks`.
- A question works from a source (the opening "Source D: …" names it): tag by what the part asks and its
  scheme, not only the source's subject. "Which city is shown in this plan?" is Key Mycenaean sites; "What
  was the original purpose of this item?" on a vase is Life in the Mycenaean age or Decorative arts as its
  scheme says.
- Literature parts on a passage: The Homeric World's are about the Odyssey's plot, characters, themes
  (`21.6`, `21.7`, `21.8`) or Homer's technique (`21.5`, similes, epithets); recalling what happened next
  is the character or theme the event belongs to. War and Warfare's are the same for its poems and texts
  (`23.5`–`23.8`).
- Roman City Life's literature parts (`22.5`–`22.8`) and culture parts (`22.1`–`22.4`) are split by `area`.
