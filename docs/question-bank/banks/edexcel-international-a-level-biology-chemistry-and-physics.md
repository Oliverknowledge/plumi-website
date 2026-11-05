# Edexcel International A Level Biology, Chemistry and Physics

Banks: `edexcel-ial-biology`, `edexcel-ial-chemistry`, `edexcel-ial-physics`

`/question-bank/edexcel-ial-biology`, `-chemistry` and `-physics`, added 2 November 2026: every
question from Pearson Edexcel's International A Level Biology (WBI11-WBI16), Chemistry
(WCH11-WCH16) and Physics (WPH11-WPH16) unit papers that Pearson publishes, January 2019 to June
2025. That is 10,109 question parts from 294 papers (Biology
3,127 from 98, Chemistry 4,117 from 99, Physics 2,865 from 97), cut part by part with their mark scheme rows and examiner's reports. Every
paper adds up to its unit's 80, 90 or 50 marks. The hub shows them as "Edexcel International A
Level" on the A-Level shelf, after the UK boards' books (level `IAL`, read by `bankLevel`; the
Edexcel IAL Maths banks use the same naming), and each links to the past paper library's
`edexcel-ial` page for its subject, which links back (`bankFor`).

- **Papers:** the six units. Units 1 to 3 are the International AS, marked AS ("AS Unit 1", `as`)
  as the A-Level banks mark their AS papers; Units 3 and 6 are the practical skills papers, in
  as normal papers. A sitting with a second paper sat in other time zones has it as its own
  series: Chemistry Units 2 and 3 in June 2024 ("01R", "June 2024 (R)") and Chemistry Unit 5 in
  June 2025 ("01A", "June 2025 (A)").
- **Source papers:** Pearson's own site only, through the past paper library's search index
  (`fetch_ial.py` imports `scripts/past-papers/boards/edexcel.py`). Each file's series is read off
  its cover, as for the International GCSE: January's papers are dated March (results day), and
  the papers printed for May/June 2020, which was cancelled, were sat in October 2020. Summer
  2021's papers are June 2021 (their provisional schemes are replaced by the final ones). Whole
  papers are on R2 under `edexcel-ial/` (`wch12-01-qp-jun24r.pdf`), crops under `bank/`.
- **Topics:** Chemistry's lettered sub-topics where the specification has them ("8B The elements
  of Groups 1 and 2"); elsewhere, and in Biology and Physics, groups of the specification's
  numbered statements with their numbers as `points` (`spec_ial.py`'s `GROUPS`): Biology 47,
  Chemistry 50, Physics 38, each subject's tiles its topics (Physics: its unit headings, "4.4
  Electric and magnetic fields"). A last tile, "Practical skills (Units 3 and 6)", holds the
  practical papers' parts that test skill with no content to speak of. Units 1 and 2 are year 1.
- **Cutting:** `cut_ial.py` runs `cut_pearson.py` with eight patches, here only: "END" in capitals
  (from `cut_igcse.py`); a levels grid's "0" row isn't a question label; nor is anything else in the
  label column that can't start a row (`stray()`: a boxed digit numbering a long answer's indicative
  content, a bare number whose question has parts, a label out of question order such as a formula's
  "1" or a nuclide's "40", or one met before but not just before); a header split "Questio / n" is
  read as "Question"; Cambria Math's inflated line boxes are measured by their size, so a scheme row
  starts at its rule (WPH14 June 2022); a part opening with a built-up fraction doesn't start
  through the marks above it; text in a font whose codes run 29 below its letters (WPH11 and WPH12
  June 2019, "\x0bD\x0c\x03'UDZ" for "(a) Draw") is read as its letters, so its part labels count;
  and a sub-part over the page that prints its letter again, "(b) (ii)", is read as (ii), so it no
  longer runs on inside "(b) (i)" (WBI16 January 2023, WBI16 June 2021, WCH14 October 2023). Every crop was checked edge by edge against the page's text lines:
  no question crop runs through a line. Marks
  the cutter can't read are set in `labels/` (`wch1101-jan24`, `wch1201-jan21`, `wph1301-jan24`,
  `wbi1101-jan19`), as are multiple-choice letters no scheme row gives (`wbi1401-jan22`, whose
  first page heads its table "Answer | Mark" with no "Question"), and a scheme row that misprints
  its label is matched to its part (`ms_alias`: "15(a)*" for the one-part Q15 in `wph1101-oct21`,
  "1(b)(i)" and "3(a)(i)" for parts with no sub-parts in `wbi1501-jun21` and `wbi1501-oct24`).
  Every scheme was also swept label by label (2 November 2026): no scheme crop holds another
  question's label, and every scheme row has a part of its own. `cropVersion` 3 marks that re-cut.
- **Multiple choice:** a part whose own words set out options A to D keeps its letter as `k`,
  read by `cut_pearson.py` or, where Biology and Physics word the row their own way ("1(a)(i) B A
  is incorrect because…", "Computer C …"), by `build_ial.py`'s `scheme_key`.
- **Tags and practicals:** tagged by Claude following `tag.md` ("Edexcel International A Level
  sciences"); practicals judged as for the other science banks.

Gaps, honestly:
- Pearson keeps October 2025 onwards for teachers, and never published October 2019's papers (its
  schemes and reports are public, so nothing to cut). The units came in one by one: Unit 1 from
  January 2019, Units 2 and 3 from June 2019, Unit 4 from January 2020, Units 5 and 6 from October
  2020.
- Three sittings have no public mark scheme, so their parts are left out: Chemistry Unit 1 June
  2023, Chemistry Unit 6 October 2023 and Physics Unit 3 October 2020.
- 15 parts (Biology 3, Chemistry 8, Physics 4) link their whole mark scheme instead of a crop of
  their row: 7 whose rows the reader doesn't find, and 8 whose rows Pearson lays out across a table
  rule (an equation or mechanism drawn over the border, a merged "clip with" row), listed in
  `labels/`'s `wholeScheme`. Every part has a scheme. A few dozen scheme crops still graze a line
  of maths whose glyph box overhangs a table rule; each was looked at and reads whole.

```bash
python3 scripts/question-bank/edexcel_ial/fetch_ial.py
python3 scripts/question-bank/edexcel_ial/spec_ial.py
python3 scripts/question-bank/edexcel_ial/cut_ial.py          # --only=wch1101-jan26 for one paper
python3 scripts/question-bank/edexcel_ial/tag_ial.py split    # tag the new batches, then:
python3 scripts/question-bank/edexcel_ial/tag_ial.py merge
python3 scripts/question-bank/edexcel_ial/build_ial.py
python3 scripts/question-bank/practicals.py split --only=edexcel-ial-biology,edexcel-ial-chemistry,edexcel-ial-physics --parts=scripts/question-bank/.work/edexcel-ial/parts.json   # judge, then merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-ial --pdf-prefix=edexcel-ial/
```
