# OCR GCSE Twenty First Century sciences

`ocr_gcse_b/tag_ocr_gcse_b.py split` writes batches for OCR's GCSE Twenty First Century Science
Biology B (J257), Chemistry B (J258), Physics B (J259) and Combined Science B (J260) to `.work/ocr-gcse-b/tag/`,
and `merge` collects them. The brief is the one in `tag.md`, with these differences:

- `<subject>-topics.txt` lists one topic per line: `code | chapter | title — what the specification
  says under it`. Codes look like `B1.2`, `C5.3`, `P4.1`; choose from these, never a chapter like
  `B1`. Combined Science B's lines have all three sciences' codes: a Biology question takes a `B`
  code, a Chemistry question a `C`, a Physics question a `P`. The Combined science paper (Paper 4
  Foundation, Paper 8 Higher) mixes the three: choose by what each part tests.
- Each line has a `paper` ("Paper 3 Higher"; "Chemistry Paper 6 Higher"). Tag by what the part
  tests, not by which paper it is on. J257-J259's "Breadth" and "Depth" papers both cover every chapter.
- Ideas about Science (B7, C7, P7) and Practical skills (B8, C8, P8) have no codes here: such
  questions (evaluating a claim, a graph or method of an experiment, risk) get the content topic
  they sit in.
- Foundation and Higher papers share questions; tag each copy on its own.
