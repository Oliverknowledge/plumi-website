# WJEC A-Level Business

Added 28 October 2026, after a student asked for it (and pointed out that WJEC's Business is
"the exact same content as Eduqas just organised in different overall chapters", which is
right: the two specifications list the same 22 content areas with word-for-word the same
learning outcomes, WJEC adding "in Wales and the rest of the UK"; WJEC sets them out as four
units, AS Units 1 and 2 and A2 Units 3 and 4, where Eduqas's Component 1 is WJEC's Units 1 and
2 together). `/question-bank/wjec-a-level-business`: 410 parts from WJEC's 30 published papers,
June 2016 (AS) and June 2017 (A2) to June 2025 (none sat in 2020 or 2021), every one tagged, 408
with their own mark scheme rows (the other two, Unit 3 June 2017 Questions 3 and 7, link the
whole scheme), 388 with their case as a stem and 362 with the examiner's comments.

- **Papers:** Units 1 and 3 are "1. Time for Tea", its case, then "(a)", "(b)", which
  `cut_wjec.py` reads. Units 2 and 4 are answered in a separate booklet and box each part's
  number, "2" then "1", with the case headed by its title alone; 2022's Unit 4 boxes the
  question's number ("0 1") and prints its parts "a)". `wjec/cut_wjec_business.py` reads both
  (a boxed part is cut as part "a" and shown "2.1"), and starts a question at its case's title
  so the case is the part's stem.
- **Schemes:** a block per part, not a table, opened by a label printed differently most
  summers ("Q3(a)", "Q 1 1", "1:1", "1. 1.", "1 (a)", "1 1" as two lines, "(b)" with its
  question carried, "4" alone for a question with no parts), with the levels grid's band
  numbers down the same column. A bare number counts only as the next question's and only where
  no other bare number shares its column. Every paper adds up the same each year: Unit 1 60,
  Unit 2 80, Unit 3 80, Unit 4 140 (its 50-mark Section A and all three 30-mark Section B
  choices; a student answers one).
- **Reports:** one a summer for the subject, a section a unit (`cut_wjec.py`). 2024's Unit 2
  heads its comments by part run together, "Q.11", "Q.12": those go with question 1. AS Unit 2
  June 2018's report comments on two questions only.
- **Topics:** `wjec/spec_wjec_business.py` reads the specification's "Content | Amplification"
  tables: Unit 1's eight areas (`1.3 Markets`), Unit 2's four areas as sections of their own
  with their sub-headings as topics (`2.3.8 Motivation`), Unit 3's ten and Unit 4's twelve
  (its PEST and ethical, legal and environmental rows are a factor each, `4.4 Economic
  factors`): 61 topics, AS ones year 1. Tagged by three readers (tag.md's WJEC section); an AS
  paper's part takes its own unit's topics, the A2 papers any.
- **Pipeline** (its own work dir, `.work/wjec-business`):

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py scripts/question-bank/.work/wjec-business --only=business
python3 scripts/question-bank/wjec/cut_wjec_business.py scripts/question-bank/.work/wjec-business
python3 scripts/question-bank/wjec/spec_wjec_business.py scripts/question-bank/.work/wjec-business
python3 scripts/question-bank/wjec/tag_wjec.py split scripts/question-bank/.work/wjec-business 140   # then tag, merge
python3 scripts/question-bank/wjec/build_wjec.py scripts/question-bank/.work/wjec-business            # writes only the banks it has parts for
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec-business --pdf-prefix=wjec/
```

`fetch_wjec.py` now also accepts "Answer all the questions" on a cover (Unit 1, 2016–19 and
2024, which it had read as inserts). Eduqas's A Level Business would be the same pipeline over
Eduqas's site, with Component 1 tagged against Units 1 and 2's topics.
