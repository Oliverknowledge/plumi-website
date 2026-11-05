# Edexcel A-Level Psychology

Added 27 October 2026, after a student asked for it: `/question-bank/edexcel-a-level-psychology`,
every question from Pearson Edexcel's A-Level (9PS0, Papers 1–3) and AS (8PS0, Papers 1–2)
Psychology papers that Pearson publishes, June 2016 to June 2025. That is 946 parts from 45
papers, each with its mark scheme cropped (levels grids whole), and 466 with the examiner's
comments. Every paper's parts add up to its printed total (`check_psychology.py`).

- **Topics** are the specification's nine (Social, Cognitive, Biological, Learning theories,
  Clinical, the three Paper 2 options Criminological, Child and Health, and Psychological
  skills), each split into its own parts: Content, Methods, Studies, Key questions,
  Practical investigation, Issues and debates. Those names repeat, so each topic's page
  title and address use a `short` ("Social psychology studies"). Topics 1–4 are Year 1
  (the AS), the rest Year 2.
- **Paper 2's options** are whole questions (Section B, one of three), so, as in the
  Geography banks, no part is marked `or`: each option's questions are tagged only to its
  own topic (`tag_psychology.py` reads which questions sit under which option off each
  paper's headings, and its merge refuses a tag outside them).
- **Cutting:** `cut_psychology.py` runs `cut_pearson.py --extracts --figures`. Geography's
  `--figures` mode stops a scheme's page number being read as a question's row (15 schemes
  had been another question's) and keeps levels grids' "0" row and tables to complete.
  The wrapper also treats the statistical tables Pearson prints before Question 1 since
  2024 as blank pages. A-Level Paper 1 June 2019 is a scan: its labels are in
  `labels/9ps001-jun19.json`, so its 12-mark essay (Q12) is kept.
- **Tags:** Claude tagged every part following `tag.md`'s "Edexcel Psychology" section.

```bash
python3 scripts/question-bank/edexcel_psychology/fetch_psychology.py
python3 scripts/question-bank/edexcel_psychology/spec_psychology.py
python3 scripts/question-bank/edexcel_psychology/cut_psychology.py
python3 scripts/question-bank/edexcel_psychology/check_psychology.py
python3 scripts/question-bank/edexcel_psychology/tag_psychology.py split   # tag the batches, then:
python3 scripts/question-bank/edexcel_psychology/tag_psychology.py merge
python3 scripts/question-bank/edexcel_psychology/build_psychology.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/edexcel-psychology --pdf-prefix=edexcel/
```
