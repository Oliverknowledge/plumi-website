# Computer Science (OCR and AQA)

`computer_science/tag_cs.py split` writes batches for OCR A-Level Computer Science
(H446, AS H046) to `.work/ocr-cs/tag/` and AQA's (7517, AS 7516) to
`.work/aqa-cs/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with
these differences:

- `cs-topics.txt` lists one topic per line: `code | section | title [AS or A-Level
  only] — what the specification says under it`. OCR's codes have three numbers
  (`1.4.2 Data structures`, `2.3.1 Algorithms`), AQA's too (`4.2.6 Hash tables`,
  `4.10.4 Structured Query Language (SQL)`); choose from these, never a section.
- Each line has a `paper` ("AS 1", "A-Level 2"). AS papers are tagged with the A-Level
  topic codes; they only test topics marked [AS]. OCR's AS Paper 2 numbers software
  development 2.2.2: it is `1.2.3` here.
- Writing, tracing or correcting code is tagged to what the code is for when the part
  is about that (a bubble sort: OCR `2.3.1`, AQA `4.3.5`; a stack: OCR `1.4.2`, AQA
  `4.2.3`), and to programming itself when it is about the language's constructs
  (OCR `2.2.1`, AQA `4.1.1`): a part asking for a while loop in place of a for loop is
  programming, whatever the loop does.
- AQA Paper 1's programming task ("Write a program that…", with its program source
  code and screen capture parts) is `4.1.1`, with a second code only where the task is
  plainly about one algorithm or structure.
