# OCR B sciences

Banks: `ocr-a-level-biology-b`, `ocr-a-level-chemistry-b`, `ocr-a-level-physics-b`

Added 25 October 2026, when a student asked for them: Biology B, Chemistry B (Salters)
and Physics B, June 2016 (AS) / 2017 (A-Level) to June 2025, 5,819 parts from 139
papers: Biology B 1,889, Chemistry B 2,049, Physics B 1,881, every one tagged, and 708
marked practical (206, 215, 287). The same pipeline with `--b`, in `.work/ocr-b-sciences`:

- **Topics** (`ocr/spec_ocr_b.py`): Biology B as Biology A (sections as tiles, numbered
  topics, Year 1 = Modules 2-3). Chemistry B's ten storylines are the tiles (the first
  five are AS), and the chemical ideas each one's learning outcomes are grouped under
  are its topics, shown with the storyline's code ("EL Atomic structure",
  specification points EL(e)–(h)). Physics B's modules are the tiles and its numbered
  units the topics (3.1.2 Sensing, 4.2 Space, time and motion, plus Module 2's
  Fundamental data analysis); Year 1 = Modules 2-4.
- **Cutting:** Chemistry B's multiple-choice keys are a narrow table of their own
  ("Question | Key | AO", "Q | Key", "No. AO | Key"), sometimes mid-page; the cutter
  reads those rows a line at a time. A few typeset papers carry a page or six as
  pictures with no text: those pages alone are read by OCR at ~290 dpi. OCR B's schemes
  print their running head along the foot of the page; scheme crops stop above it.
- **Tagging:** `tag_ocr.py split --b` / `merge --b`, briefed by tag.md's "OCR B sciences".

Gaps: OCR doesn't publish June 2023 for Biology B AS. Two mark scheme links on OCR's
site serve another paper's scheme (Biology B November 2020 Paper 1, AS June 2025
Paper 2), so those 96 parts link no scheme; the June 2017 Biology B examiners' report
covers every paper at once and isn't split by question. H157/01 June 2025's scheme
leaves out questions 4 and 8. Marks add up exactly for 137 of 139 papers; Biology B
June 2019 Paper 1 and June 2017 Paper 3 are each one mark short, where a "[1]" sits on
a page's last line.

```bash
python3 scripts/question-bank/ocr/fetch_ocr.py --b --from=<the library's .work/ocr>
python3 scripts/question-bank/ocr/spec_ocr_b.py
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/ocr-b-sciences
python3 scripts/question-bank/ocr/tag_ocr.py split --b    # tag, then: tag_ocr.py merge --b
python3 scripts/question-bank/ocr/build_ocr.py --b
python3 scripts/question-bank/practicals.py split --parts=scripts/question-bank/.work/ocr-b-sciences/parts.json \
  --only=ocr-a-level-biology-b,ocr-a-level-chemistry-b,ocr-a-level-physics-b   # judge, then: practicals.py merge
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-b-sciences --crops-only
```

**Crop version 3 (26 October 2026).** The OCR banks were re-cut again with the merged cutter:
#28's rule-based scheme rows (whole rows, no slivers of the row above), and no labels before
a scheme's first table (MEI's numbered marking instructions had been read as question 5's
scheme). Where the new cut found no scheme but the live data had a real one, the live crop
was kept; four live crops that were only slivers ("Question Answer Marks Guidance") now
link the whole scheme instead.

**Re-cut 26 October 2026 (crop version 2).** A paper's last scheme crop ran on to OCR's back
pages ("Need to get in touch?", the company notice, blank pages, and in older schemes a
contact block under the last answer). `cut_pearson.py` now stops at them (`BACK_PAGE`,
`BACK_BLOCK`). All ten OCR banks were re-cut from their work folders and rebuilt: no part,
tag or mark lost; 444 OCR A multiple-choice parts gained their answer; scheme crops lost
OCR's running heads and footers. Crops are cached as immutable, so a re-cut bank carries
`cropVersion` (set in `ocr/build_ocr.py`, `CROP_VERSION`) and its crop URLs ask for
`?v=<version>`: bump it whenever a bank's crops are re-uploaded under the same names.
