# Cambridge International AS & A Level Computer Science (9618)

Bank: `caie-a-level-computer-science`

Added 5 November 2026, after a member asked for "9618" on 29 October. 198 parts from the 8 papers Cambridge
publishes on its own site, the same "June 2024 and the specimen papers" scope as the other CAIE banks (see
`cambridge-international.md` for why: the archive is behind the School Support Hub login, and we use no mirrors).

| Paper | June 2024 | Specimen (2021) |
| --- | --- | --- |
| 1 Theory Fundamentals (AS) | 9618/11: 26 parts | 9618/01: 27 |
| 2 Fundamental Problem-solving and Programming Skills (AS) | 9618/21: 22 | 9618/02: 20 |
| 3 Advanced Theory | 9618/31: 29 | 9618/03: 29 |
| 4 Practical | 9618/41: 25 | 9618/04: 20 |

Every paper's parts add up to its 75 marks, and every part has its own mark scheme rows. The 102 June 2024 parts have the
examiner's report on their question (the report covers June 2024 only; specimens have none). The June 2024 papers are
one time-zone variant each (11, 21, 31, 41): Cambridge's public site has no other variant.

- **Unit:** the part, as the sciences. Questions share a stem (a scenario, a table, a flowchart) that goes with each of
  their parts.
- **Topics** (`spec_caie.py --cs`), from the 2024-2025 syllabus the June 2024 papers were set on: 20 sections, 44
  sub-topics ("19.1 Algorithms"). Sections 1-12 are AS ("Year 1 · AS"), 13-20 A Level only. The 2021 specimens' content is the
  same. Paper 1 (11, 01) and Paper 2 (21, 02) are AS papers.
- **Paper 4 is sat at a computer** in Java, Python or VB.NET: its questions build one program over several parts and its
  mark schemes give an answer in each language. Each sitting's support files (a zip of the evidence document and data
  files the candidate works from, `9618-41-support-file`) are linked with its whole paper, as `code`. Paper 2's insert (the
  pseudocode functions and operators) is left to the library: the bank's insert links are worded for sources.
- **Cutting:** `edexcel_sciences/cut_pearson.py` behind `Doc.cambridge`, with these additions for 9618, all Cambridge-only,
  so OCR and Pearson cut as before:
  - Cambridge's flowchart ends in a terminator box reading "END", which was taken for Pearson's closing "END" and
    cut Paper 2 Q2(a) short (and lost its "[5]", so the paper added to 76 marks);
  - `[n]` straight after a word ("Data[3]" in a trace table) is an array index, not marks;
  - a scheme row's label is read as the one piece "1(b)", not with the "1 mark each" beside it;
  - the 2021 specimen schemes draw only some of their row rules: a short rule under an answer's underlined words is no
    row border; a row with no rule under it is cut to the foot of its last line; and where the only rule found is an
    inner table's (9618/02 specimen Q1(a), set sideways), the row starts midway between the row above's text and its
    label, so "One mark per row" stays with its table.
  Pages of nothing but answer lines after a part are left out, as in every bank.
- **Gaps:** only June 2024 and the 2021 specimens are public (Cambridge's page lists nothing newer, checked 5 November 2026).
  Paper 2's insert and Paper 4's data files are links only. A part whose answer runs on over a page keeps only the page
  with its question: pages of nothing but answer lines are left out, as in every bank, so a long pseudocode answer's crop
  ends at its lines without its "[8]".

```bash
python3 scripts/question-bank/caie/fetch_caie.py --cs [--from=<past-papers cie work dir>]
python3 scripts/question-bank/caie/spec_caie.py --cs
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-cs
python3 scripts/question-bank/caie/tag_caie.py split scripts/question-bank/.work/caie-cs 120   # tag, then: merge
python3 scripts/question-bank/caie/build_caie.py scripts/question-bank/.work/caie-cs
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-cs --crops-only
python3 scripts/past-papers/upload.py cie   # the whole papers: only 9618's files are new
npm run bank:data -- caie-a-level-computer-science
```
