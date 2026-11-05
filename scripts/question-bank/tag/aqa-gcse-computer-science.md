# AQA GCSE Computer Science

`aqa_gcse_cs/tag_gcse_cs.py split` writes batches of AQA GCSE Computer Science (8525) parts to
`.work/aqa-gcse-cs/tag/`, and `merge` collects them. The brief is the one in `tag.md`, with
these differences:

- `cs-topics.txt` lists one topic per line: `code | section | title — the specification's
  words`. The codes are the specification's numbered headings (`3.2.6`, `3.6.2.1`), plus
  `3.5a` to `3.5e` (networks, which the specification doesn't number: types of network,
  star and bus topologies, protocols, network security, the TCP/IP model) and `3.8` (ethical, legal and environmental
  impacts). Choose from these, never a section like `3.2`.
- Paper 1 is set in three languages with the same questions; only the Python paper (1B) is
  batched, and merge copies each part's tags to its C# and VB.NET copies by series and label.
- Paper 1 (`paper` 1) is algorithms and programming: tracing an algorithm or saying what it
  outputs is `3.1.1`; a search or sort `3.1.3`/`3.1.4`; writing a program, tag what it mainly
  uses (`3.2.2` iteration and selection, `3.2.6` arrays and records, `3.2.10` subroutines,
  `3.2.11` validation and authentication, `3.2.8` strings, `3.2.9` random numbers); a trace
  table or the purpose of an algorithm `3.1.1`; types of error and testing `3.2.11`.
- Paper 2 (`paper` 2) is everything else: binary, hex, shifts and units `3.3.x`; a file
  size calculation for an image or sound `3.3.6`/`3.3.7`; Huffman or RLE `3.3.8`; logic
  gates and truth tables `3.4.2`; SQL `3.7.2`; a long answer on threats and protection
  `3.6.2` with `3.6.3`.
