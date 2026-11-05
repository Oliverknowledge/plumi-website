# Cambridge International (CAIE)

Banks: `caie-a-level-maths`, `caie-a-level-further-maths`, `caie-a-level-biology`, `caie-a-level-chemistry`, `caie-a-level-physics`

Added 25 October 2026, after a student asked for CAIE:

| Bank | Syllabus | Unit | Questions |
| --- | --- | --- | --- |
| `/question-bank/caie-a-level-maths` | 9709, Papers 1-6 | whole question | 100 |
| `/question-bank/caie-a-level-further-maths` | 9231, Papers 1-4 | whole question | 56 |
| `/question-bank/caie-a-level-biology` | 9700, Papers 1, 2, 4, 5 | part | 240 |
| `/question-bank/caie-a-level-chemistry` | 9701, Papers 1, 2, 4, 5 | part | 312 |
| `/question-bank/caie-a-level-physics` | 9702, Papers 1, 2, 4, 5 | part | 266 |

Students search "CAIE" and "Cambridge International" (and "AS & A Level"), so the
board is "CAIE" in titles, the hub shelf is "Cambridge International (CAIE)", and
each bank's lead names the syllabus ("Chemistry (9701)").

**What's public, and so what's here.** Cambridge keeps its past paper archive on the
School Support Hub, for registered schools; we never fetch from it or from mirrors.
Its public site has, per syllabus, one series (May/June 2024, one time-zone variant
of each component: 9709/11, not /12 or /13), that series's examiner report, and the
specimen papers (maths for exams from 2020, sciences from 2022). The banks are those,
about half June 2024 and half specimens, and say so: `scope` ("June 2024 and the
specimen papers") replaces the year range in their copy and metadata, and their
leads say the rest is on the School Support Hub. When Cambridge rotates the public
series (to May/June 2025, say), re-run the library's `boards/cie.py`, then the steps
below: the old series stays only if we kept its files.

- **Papers:** the past paper library's CIE fetcher (`scripts/past-papers/boards/cie.py`,
  PR #15) downloads everything public, with `gaps.md` listing what isn't.
  `caie/fetch_caie.py` (and `--maths`) copies the question papers and schemes the bank
  needs; the "whole paper" links are the library's R2 keys (`cie/CIE-9709-11-QP-JUN24.pdf`),
  already in the bucket. One report covers the whole syllabus, a section per component,
  so each component's set points at it with `section: "9709/11"`.
- **Papers left out:** the science practicals (Paper 3): their questions are
  instructions for apparatus on the bench. Paper 5 (planning, analysis and evaluation)
  is in.
- **A paper** is its syllabus and number, the same for the June sitting (9709/31) and
  the specimen (9709/03): `97093`, so the paper filter lists each paper once.
- **Topics:** from Cambridge's current syllabuses (`caie/spec_caie.py`; sciences
  2025-2027, maths 2026-2027, which match the 2024 papers and specimens): topics ("23
  Chemical energetics") as tiles and sub-topics ("23.1 Lattice energy and Born-Haber
  cycles") under them. Sciences: topics 1-11 (Chemistry 1-22) are Year 1 · AS. Maths
  is set out by paper, so a paper's content is a tile ("Pure Mathematics 3") and a
  question only takes its own paper's codes (merge enforces it).
- **Cutting:** `edexcel_sciences/cut_pearson.py` reads Cambridge's layout too, all of
  it behind `Doc.cambridge` (a "© UCLES" or "Cambridge International" on the first
  pages), so Pearson and OCR cut exactly as before (checked: OCR's 8,182 parts and
  their images came out byte for byte the same). It turns the specimen schemes'
  landscape tables, set sideways on portrait pages without a rotation flag; keeps
  scheme crops inside the table, under the running header and above the footer; skips
  the numbered marking instructions before the first "Question" header and the
  numbered answer points beside the narrow Question column; reads a question number
  and its "(a)" a fraction of a point apart as one line; ignores "(n)" in tables when
  counting marks; ends a paper's last question at its data sheet, periodic table or
  copyright notice (Cambridge prints no "END OF QUESTION PAPER"); and gives a
  multiple-choice question its 1 mark.
- **Tagging:** `caie/tag_caie.py split|merge` for both work folders, briefed by
  tag.md's CAIE section.
- **Building:** `caie/build_caie.py` for both work folders.

Gaps: Cambridge's public link for the 9231 Paper 2 specimen mark scheme serves the
question paper itself, so those 8 questions have no scheme (fetch_caie.py leaves the
file out). One scheme misprint, 9701/51 "1(b)(ii)" for 1(c)(ii), is read as the part
it follows. IGCSE is below.

```bash
python3 scripts/question-bank/caie/fetch_caie.py [--maths]
python3 scripts/question-bank/caie/spec_caie.py [--maths]
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-sciences
python3 scripts/question-bank/edexcel_sciences/cut_pearson.py scripts/question-bank/.work/caie-maths --whole
python3 scripts/question-bank/caie/tag_caie.py split [scripts/question-bank/.work/caie-maths]   # tag, then: merge
python3 scripts/question-bank/caie/build_caie.py [scripts/question-bank/.work/caie-maths]
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-sciences --crops-only   # the PDFs are the library's
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/caie-maths --crops-only
```
