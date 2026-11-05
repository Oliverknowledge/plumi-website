# OCR GCSE Gateway sciences

`ocr_gcse/tag_ocr_gcse.py split` writes batches for OCR's GCSE Gateway Biology A (J247),
Chemistry A (J248), Physics A (J249) and Combined Science A (J250) to `.work/ocr-gcse/tag/`,
and `merge` collects them. The brief is the one in `tag.md`, with these differences:

- `<subject>-topics.txt` lists one sub-topic per line: `code | topic | title — what the
  specification says under it`. Codes look like `B1.2`, `C5.3`, `P4.1`; choose from these,
  never a topic like `B1`. Combined Science A's lines have all three sciences' codes: a
  Biology paper's question takes a `B` code, a Chemistry paper's a `C` and a Physics paper's a `P`.
- Each line has a `paper` ("Paper 3 Higher"; "Chemistry Paper 9 Higher"). Tag by what the
  part tests, not by which paper it is on.
- The practical skills topic (B7, C7, P9) has no codes here: practical questions get the
  content topic they sit in.
- Foundation and Higher papers share questions; tag each copy on its own.
