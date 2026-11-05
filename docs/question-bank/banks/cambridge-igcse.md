# Cambridge IGCSE

Banks: `caie-igcse-maths`, `caie-igcse-additional-maths`, `caie-igcse-biology`, `caie-igcse-chemistry`, `caie-igcse-physics`

Added 25 October 2026, after the A Level banks:

| Bank | Syllabus | Unit | Questions |
| --- | --- | --- | --- |
| `/question-bank/caie-igcse-maths` | 0580 (and 9-1 0980), Papers 1-4 | whole question | 228 |
| `/question-bank/caie-igcse-additional-maths` | 0606, Papers 1-2 | whole question | 46 |
| `/question-bank/caie-igcse-biology` | 0610 (and 9-1 0970), Papers 1-4, 6 | part | 346 |
| `/question-bank/caie-igcse-chemistry` | 0620 (and 9-1 0971), Papers 1-4, 6 | part | 407 |
| `/question-bank/caie-igcse-physics` | 0625 (and 9-1 0972), Papers 1-4, 6 | part | 355 |

The same public papers (June 2024 and the specimens) and the same scripts, with
`--igcse`. The banks' level is "IGCSE" (`BankSubject.level`), so titles read "CAIE IGCSE
Biology", and their "every paper" links go to the library's `/past-papers/gcse-*/cie-igcse`
pages, where Cambridge IGCSE (Additional Maths too) shelves with GCSE.

- **The 9-1 syllabuses.** 0970, 0971 and 0972 sit 0610, 0620 and 0625's papers word for
  word (June 2024 and specimens compared: the same text), so they are left out and the
  banks name them (`fullName` "Biology (0610 and 9–1 0970)", `specs`). Mathematics 9-1
  0980 shares 0580's specimens, but its public June 2024 papers are another time-zone
  variant (0980/12, /22, /32, /42 against 0580/11, /21, /31, /41), different questions on
  the same content: they are in the 0580 bank as 0580's papers in a second sitting,
  series `JUN24V2`, "June 2024 (0980)". The bank's sort reads that as June 2024 and keeps
  the two variants apart.
- **Papers left out:** the science practical tests (Paper 5). Paper 6, the alternative to
  practical, is in. Core (1, 3) and Extended (2, 4) papers say which in their titles.
  Maths papers are just "Core" or "Extended": the 2025 specimens' Papers 1 and 2 are
  non-calculator, June 2024's (the previous syllabus) were not.
- **Topics** (`spec_caie.py --igcse`), from the syllabuses the papers were set on
  (sciences 2023-2025, maths 2025-2027), tiles' titles read from each content overview:
  sciences as A Level (topic tiles, "8.3 Transpiration" under them); 0580 by its
  sub-topic numbers, which Core (C1.1) and Extended (E1.1) share, as `1.1`, with
  `extended` on the 19 Core leaves out (merge keeps them off Core papers); 0606 numbers
  single learning statements, not titled sub-topics, so each of its 14 topics is one
  tile and one code.
- **Cutting** (still all behind `Doc.cambridge`): the 2025 specimens print neither "©
  UCLES" nor "Cambridge International", only "Cambridge IGCSE™", which now marks a
  Cambridge paper too ("Cambridge University Press & Assessment" would catch OCR's);
  Cambridge's white text is ignored (the maths specimens hide a second "[2]" under some
  answer lines, which had doubled their marks); and a bold question number may run
  straight into algebra in its span ("10 a = 5/7"). Every set's marks add up to the
  paper's total. Scheme rows now start at the table rule above their label rather than
  6pt above it: Cambridge's one-line rows sit closer than that, so a third of the crops
  (A Level's too) had lost the foot of their last line, and a whole question's rows
  showed a sliver of the one above. The A Level banks were re-cut and their scheme crops
  re-uploaded (questions, marks and tags unchanged; search text lost some hidden white
  text). `upload_r2.py --checksum` compares R2's checksums rather than sizes, since a
  re-cut crop can keep its size.
- **Gaps:** 0625/21 Question 14 is left out ("Question Discounted" in Cambridge's scheme).
  Cambridge's 0980 report has no Paper 42 section, so those questions have no report.
  The multiple-choice reports discuss only some questions.

```bash
python3 scripts/question-bank/caie/fetch_caie.py --igcse [--maths]
python3 scripts/question-bank/caie/spec_caie.py --igcse [--maths]
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-igcse-sciences
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-igcse-maths --whole
python3 scripts/question-bank/caie/tag_caie.py split scripts/question-bank/.work/caie-igcse-sciences 120   # tag, then: merge
python3 scripts/question-bank/caie/build_caie.py scripts/question-bank/.work/caie-igcse-sciences   # and caie-igcse-maths
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-igcse-sciences --crops-only
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-igcse-maths --crops-only   # after a re-cut: --checksum
```
