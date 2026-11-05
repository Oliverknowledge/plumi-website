# OCR Psychology and Sociology

`ocr_psychology/tag_ocr_psychology.py split` and `ocr_sociology/tag_ocr_sociology.py split` write the
OCR A-Level Psychology (H567) and Sociology (H580) questions to `.work/ocr-psychology/tag/` and
`.work/ocr-sociology/tag/`, and `merge` collects them. The questions of November 2021 to June 2025
were tagged on 1 November 2026 by reading each question and the start of its scheme. The brief is the
one in `tag.md`, with these differences:

- `<subject>-topics.txt` lists the topics: `code | section [option: id] | title — what it covers`. The
  specifications don't number their content, so the codes are the section's and the topic's place in
  it: Psychology `1` research methods, `2A` core studies (a key theme and its two studies), `2B` areas,
  perspectives and debates, `2C` practical applications, `3A` issues in mental health, `3B`-`3E` the
  Paper 3 options; Sociology `1A` socialisation, culture and identity, `1B`-`1D` Paper 1's options, `2A`
  research methods, `2B` social inequalities, `3A` globalisation and the digital social world, `3B`-`3D`
  Paper 3's options.
- Each line has its `paper` and, for an option's question, its `option`: an option's question takes
  its option's topics, and merge drops a code from another paper's sections (Psychology Paper 2 may use
  research methods and Paper 3 research methods or the debates; nothing else crosses papers).
- Psychology: a question about a core study is that study's key theme (`2A.x`), even when it asks about
  its method, unless it is plainly about a research method in general; a question comparing a study's
  area or a debate with evidence from core studies is the area or debate (`2B.x`). Paper 1's questions
  on its study go to the skill they test (sampling `1.6`, a statistical test `1.11`). An option's
  question goes to the topic its key research or application belongs to; its "Discuss…" question about a
  debate or issue (ethnocentrism, usefulness) takes the option's topic first.
- Sociology: the essay questions take the content topic first and a theory or method second only when
  the question names it ("Assess Marxist views of the nuclear family" is `1B.3`). Paper 2's source
  questions take the method they ask about (`2A.x`); Section B takes the inequality or the theory.
