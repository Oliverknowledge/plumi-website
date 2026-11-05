# Edexcel International A Level sciences

`edexcel_ial/tag_ial.py split` writes batches for Pearson Edexcel's International A Level
Biology (WBI11-16), Chemistry (WCH11-16) and Physics (WPH11-16) to `.work/edexcel-ial/tag/`, and
`merge` collects them. The brief is the Edexcel one above, with these differences:

- Chemistry's codes are its lettered sub-topics where the specification has them (`8.B` is "8B
  The elements of Groups 1 and 2"); elsewhere, and in Biology and Physics, a code is a group of
  the specification's numbered statements (shown in brackets): `6.2` is the second group of
  Topic 6, not statement 6.2, and Physics' `2.3.4` is the fourth group of heading 2.3. Tag by content.
- Each line has a `paper`, its unit ("AS Unit 2", "Unit 5"). Units 1 and 2 test the topics marked
  [AS]; Units 4 and 5 the [A-Level only] ones, and can lean on AS content.
- Units 3 and 6 are the practical skills papers. Tag each part to the content topic its
  experiment is about (a titration's calculation is the titration topic; an enzyme experiment is
  "Proteins and enzymes"). Use `P.1` ("Practical skills") only when the part tests practical
  skill with no content to speak of: uncertainty and percentage error, choosing apparatus,
  plotting or reading a graph, safety, improving a method. A part can have a content topic and
  `P.1`.
- Practicals in Units 1, 2, 4 and 5 get the content topic they sit in.
