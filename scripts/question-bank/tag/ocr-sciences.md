# OCR sciences

`ocr/tag_ocr.py split` writes batches for OCR's A-Level Biology A, Chemistry A
and Physics A to `.work/ocr-sciences/tag/`, and `merge` collects them. The brief is
the one in `tag.md`, with these differences:

- `<subject>-topics.txt` lists one topic per line: `code | section | title [AS or
  A-Level only] — what the specification says under it`. Codes have three numbers
  (`3.1.2`); choose from these, never a section like `3.1`.
- Each line has a `paper` ("AS 1", "A-Level 3"). AS papers only test topics marked
  [AS] (Modules 2-4); A-Level Paper 3 is synoptic and can test anything.
- Module 1 (practical skills) has no codes here: practical questions get the content
  topic they sit in.
