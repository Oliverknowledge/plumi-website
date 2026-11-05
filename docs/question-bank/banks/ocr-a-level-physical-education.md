# OCR A-Level Physical Education

Added 5 November 2026: `/question-bank/ocr-a-level-physical-education`, every question from the three written
papers of OCR's A-Level Physical Education (H555) that OCR publishes on its own site: Paper 1 (Physiological
factors affecting performance, 90 marks), Paper 2 (Psychological factors affecting performance, 60) and Paper 3
(Socio-cultural issues in physical activity and sport, 60), for November 2021 and June 2022 to June 2025. That is
305 questions and parts from 15 papers (Paper 1 118, Paper 2 100, Paper 3 87), and every paper adds up to its
OCR total. Every part has its mark scheme cropped and its topic, and every series but November 2021 has examiners'
reports (243 parts; the 62 without are November 2021's 61 and Paper 1 June 2023 question 3, which OCR's report skips).
Requested by a member on the Discord bot on 1 November 2026 ("Physical Eduction", OCR, A-level).

- **Layout.** Numbered questions with parts and sub-parts, answer lines in the paper (so each crop stops at the
  first answer line and its marks), tables, graphs, photographs and diagrams inside the part's own crop, an
  8-part Section A of short questions and 10 or 20 mark starred essays. It is typeset like OCR's sciences and
  Economics, so `ocr_economics/cut_ocr_economics.py` does the cutting, unchanged, used as a library, and
  `ocr_pe/cut_ocr_pe.py` patches a few slips on top for this run only (listed in its docstring, below).
  No part is set on case material. 12 parts have a stem: a question's own opening words and figure above
  its parts (a pull-up, a press-up, a true/false stem).
- **Mark schemes.** One row per part, with its AO marks and guidance. The 20 and 10 mark essays carry the levels
  grid and their indicative content, across pages (5,000 px tall for the longest). Where a scheme prints two
  parts in one row, both show it: Paper 3 June 2023 6(a)(i)/(ii) and 6(c)(i)/(ii), Paper 2 November 2021
  5(a)/(b), Paper 3 June 2025 1(a)/(b) (`labels/h55502-nov21.json` and its siblings).
- **Examiners' reports.** Kept by question, so a part shows its whole question's report under headings that
  name each part. "Question 4 (a) and (b)" is read as Question 4.
- **Sources OCR left out.** Paper 3 June 2024 7(a)(i)'s picture and November 2021 7(d) (the Hundred's kits, from The Times) are printed as a grey or black box and a line "Item removed due to third party copyright
  restrictions". The box is painted out and closed up to a line saying so.
- **Topics.** The specification doesn't number its topic areas, so the codes are the section's and the area's place
  in it (`1.1.6` Cardiovascular system at rest). 7 sections (1.1 Applied anatomy and physiology, 1.2 Exercise
  physiology, 1.3 Biomechanics, 2.1 Skill acquisition, 2.2 Sports psychology, 3.1 Sport and society, 3.2
  Contemporary issues in physical activity and sport) and 54 topic areas, each a row of the specification's
  content tables; the `ref` is the lettered subsection ("1.1.b"). 31 are AS content (year 1: where the AS
  specification H155 has a topic area of the same name), 23 are A-Level only. Every part was tagged by reading it
  (tag/ocr-physical-education.md); essays carry two topics. Two topics have no questions: Functional roles of
  muscles and types of contraction (1.1.2) and ATP and energy transfer (1.1.10), which questions on the same
  ideas put under 1.1.1/1.1.3 and 1.1.11.
- **AS (H155).** OCR also publishes AS papers, H155/01 (Physiological factors) and H155/02 (Psychological and
  socio-cultural themes in physical education), for June 2022 to June 2025, with reports. This bank is A-Level only;
  an AS bank would be a copy of this pipeline over those papers.
- **Gaps.** OCR's public site has nothing before November 2021 (the earlier series, 2017 to 2020, are on Teach
  Cambridge, OCR's teacher login); the practical performance (H555/05) and evaluating and analysing (H555/06)
  components have no papers (moderators' reports only), and the modified papers, specimen papers and the NEA
  are left out. No third-party mirror was used.
- **Pipeline.** `scripts/question-bank/ocr_pe/`: `fetch_ocr_pe.py` (the law fetcher's way, over OCR's assessment page
  with `fetch_ocr_cs.py`'s reader), `spec_ocr_pe.py`, `cut_ocr_pe.py`, `tag_ocr_pe.py`, `build_ocr_pe.py`. No shared
  script changed. Papers are on R2 under `ocr/OCR-H555-*`, crops under `bank/h555*`.

```bash
python3 scripts/question-bank/ocr_pe/fetch_ocr_pe.py
python3 scripts/question-bank/ocr_pe/spec_ocr_pe.py
python3 scripts/question-bank/ocr_pe/cut_ocr_pe.py
python3 scripts/question-bank/ocr_pe/tag_ocr_pe.py split   # tag each batch by tag.md and tag/ocr-physical-education.md, then
python3 scripts/question-bank/ocr_pe/tag_ocr_pe.py merge
python3 scripts/question-bank/ocr_pe/build_ocr_pe.py
ln -sfn ../img scripts/question-bank/.work/ocr-pe/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-pe/r2 --pdf-prefix=ocr/
python3 scripts/question-bank/upload_data.py ocr-a-level-physical-education
```
