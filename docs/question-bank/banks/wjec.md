# WJEC (Wales)

Banks: `wjec-a-level-biology`, `wjec-a-level-chemistry`, `wjec-a-level-physics`, `wjec-a-level-maths`

Added 26 October 2026, after students asked for WJEC:

| Bank | Units | Unit of the bank | Questions |
| --- | --- | --- | --- |
| `/question-bank/wjec-a-level-biology` | 2400U10, 2400U20 (AS), 1400U30, 1400U40 | part | 1,223 |
| `/question-bank/wjec-a-level-chemistry` | 2410U10, 2410U20 (AS), 1410U30, 1410U40 | part | 1,204 |
| `/question-bank/wjec-a-level-physics` | 2420U10, 2420U20 (AS), 1420U30, 1420U40 | part | 1,173 |
| `/question-bank/wjec-a-level-maths` | 2300U10, 2300U20 (AS), 1300U30, 1300U40 | whole question | 314 |

Series: every summer WJEC publishes, Summer 2016 (the sciences' AS units; their A2
units start in 2017) to Summer 2025, without 2020 and 2021 (no exams); Maths from
Summer 2018. Every paper there is has its scheme; examiners' reports from 2017
(Biology from 2016). WJEC calls its series "Summer 2023", so the banks do; the ids
stay `JUN23`. Students in Wales say "WJEC A Level", so the shelf is "WJEC AS & A Level
(Wales)" and papers are units: "AS Unit 1", "Unit 3".

- **Source: WJEC's own site only.** Each qualification page loads its "Past Papers /
  Mark Schemes" tab from `/umbraco/surface/TabSurface/GetpastpapersTab`, a JSON list
  linking to `pastpapers.download.wjec.co.uk`, and its key documents (the specification
  and the examiners' reports) from `GetkeydocumentsTab`; `wjec/fetch_wjec.py` reads
  both. Never Physics & Maths Tutor, which the past paper library's WJEC links point at.
  English-medium papers only. Left out: the practical exam (Unit 5), modified
  large-print papers (one, 2018 Maths Unit 1, is listed as the "Past Paper" itself, so
  `-mlp` files are dropped by name), inserts and data booklets. The list's labels
  aren't trusted: 2019 lists every scheme twice, 2016's Physics "Past Paper" rows are
  its schemes, and two Chemistry scheme covers misprint their unit code, so each file is
  read for what it is. Whole papers are `wjec/WJEC-2420U10-1-QP-JUN23.pdf` in R2 (the
  bucket already held the papers and schemes under these names, byte for byte; the
  reports, `wjec/WJEC-physics-ER-JUN23.pdf`, one per subject a summer, are new).
- **Cutting:** `wjec/cut_wjec.py` uses `edexcel_sciences/cut_pearson.py` as a library,
  unchanged (so no other board's crops move), and sets WJEC's differences in its place
  for its own run: question numbers with a full stop ("1."), papers ending at "END OF
  PAPER", Unit 4's options headed "Option A – Alternating Currents" with no number
  (numbered on from the last question, as the schemes do), the "[6 QER]" marks of the
  extended response question, maths's boxed numbers ("0" "1") and whole questions, the
  schemes' "Summary of marks allocated" grid and "Question 1 total" rows (left off),
  their "1." labels, their three label columns read a point apart, and maths's "Q"/"Qu."
  header and mechanics tables closed by "Total for Question 7". Check: every paper's
  marks per question match its cover's mark grid, except where a question's marks are
  the options' (all four options are in, so Physics Unit 4 sums to 160).
- **Topics:** `wjec/spec_wjec.py` reads the specifications: a tile per unit, its topics
  under it ("1.2 Kinematics"), Unit 4's options as their own topics (`4.A`). Maths uses
  the Edexcel maths topics, as the OCR and CAIE maths banks do.
- **Tagging:** `wjec/tag_wjec.py split|merge`, tag.md's WJEC section; every part of an
  option takes its option's code without a reader.
- **Practicals:** 295 parts (Biology 74, Chemistry 106, Physics 115), judged as below.

Gaps: no 2016 reports for Physics or Chemistry (WJEC publishes none). A few report
sections are written by theme, not question (Chemistry Unit 4 and Biology Unit 2 in
2025), and the maths reports comment only on some questions, so those have none;
3,440 of 3,914 have one. 20 science parts have no scheme crop
and link the whole scheme. Not built yet: the GCSEs (legacy Wales sciences and maths, being replaced by the Made-for-Wales GCSEs).

```bash
python3 scripts/question-bank/wjec/fetch_wjec.py            # --only=physics for one subject
python3 scripts/question-bank/wjec/spec_wjec.py
python3 scripts/question-bank/wjec/cut_wjec.py               # the sciences; --only=2420u10-jun23 for one paper
python3 scripts/question-bank/wjec/cut_wjec.py --whole       # maths
python3 scripts/question-bank/wjec/tag_wjec.py split         # tag, then: merge
python3 scripts/question-bank/wjec/build_wjec.py
python3 scripts/question-bank/practicals.py split --parts=scripts/question-bank/.work/wjec/parts.json --only=wjec-a-level-biology,wjec-a-level-chemistry,wjec-a-level-physics   # judge, then merge --only=…
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/wjec --pdf-prefix=wjec/
```
