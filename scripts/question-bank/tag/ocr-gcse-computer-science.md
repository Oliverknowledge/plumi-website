# OCR GCSE Computer Science

`ocr_gcse_cs/tag_ocr_gcse_cs.py split` writes batches of OCR GCSE Computer Science (J277)
parts to `.work/ocr-gcse-cs/tag/`, and `merge` collects them. The brief is the one in `tag.md`,
with these differences:

- `cs-topics.txt` lists one topic per line: `code | section | title — the specification's
  words`. The codes are the specification's sub topics (`1.3.2`, `2.1.3`); choose from these,
  never a section like `1.3`. The specification's 1.2.4 Data storage is four topics here:
  `1.2.4a` numbers (binary, hexadecimal, binary addition, overflow, shifts), `1.2.4b`
  characters (character sets, ASCII, Unicode), `1.2.4c` images and `1.2.4d` sound.
- Each line has a `paper`. Paper 1 tests 1.x only, Paper 2 tests 2.x only; merge drops a code
  from the wrong paper.
- A file size or storage capacity calculation is `1.2.3`, unless the part is about what
  changes an image's or a sound's size or quality (`1.2.4c`, `1.2.4d`).
- On Paper 2, writing, completing or correcting a program is `2.1.2` when it is about the
  algorithm (inputs, processes, outputs; trace tables; flowcharts; fixing logic or syntax
  errors), `2.2.1` when it is about the constructs themselves (variables, constants,
  operators, selection, iteration), `2.2.3` for string handling, files, arrays, SQL, sub
  programs and random numbers, and `2.3.1` for validation, authentication and maintainable
  code. A search or sort, traced or written, is `2.1.3`. Add a second code only where the
  part is as much about another of these.
- A truth table or logic diagram is `2.4.1`; test data and test plans `2.3.2`; IDE tools,
  translators and language levels `2.5.1` or `2.5.2`.
