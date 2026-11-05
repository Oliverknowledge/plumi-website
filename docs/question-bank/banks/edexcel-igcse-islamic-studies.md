# Edexcel International GCSE Islamic Studies (4IS1)

Added 2 November 2026: `/question-bank/edexcel-igcse-islamic-studies`, Pearson Edexcel International GCSE Islamic
Studies, every series Pearson's own site has public.

| Paper | Sittings | Questions | Scheme crops | Reports |
| --- | --- | --- | --- | --- |
| 4IS1/01 (the only paper, 90 marks) | 7: June 2019, November 2020, June 2021, June 2022 to June 2025 | 168 | 168 | 144 parts (36 questions) |

A candidate answers Question 1 or 2 (Section A), 3 or 4 (Section B), then 5 and 6 (Section C); every sitting's
Questions 1, 3, 5 and 6 add up to its 90 marks, and 1 to 2, 3 to 4 (`check_igcse_islamic.py`).

- **Naming:** as the other Edexcel International GCSE banks (board "Edexcel", level "IGCSE", shown as "International
  GCSE"); subject "Islamic Studies", a book of its own on the GCSE & IGCSE shelf. There is no past paper library page
  for it, so the bank's "whole papers" credit links to `/past-papers`.
- **Sources, Pearson's own site only:** its search index lists every 4IS1 paper, scheme and report; the series is
  Pearson's own tag on each file (November 2020's scheme is dated February 2021). June 2021 is the assessment
  material Pearson published for the year exams were cancelled, with its scheme; it has no report. Whole papers are on
  R2 under `edexcel-igcse/` (`4is1-01-qp-jun24.pdf`), crops under `bank/`.
- **Not in:** June 2026, which Pearson keeps for teachers (`/secure/`); there are no January, November (other than
  2020) or "R" sittings of 4IS1. The specimen paper and the legacy Islamiyat (4IS0) papers are left out.
- **Arabic:** every (d) is set on a Qur'an or Hadith passage printed in Arabic with its English under it. The crops
  are rendered from the PDF, so the Arabic shows as printed. Its text layer does not read (presentation forms, wrong
  order), so the Arabic is left out of the search text and the part is searched by its English.
- **Cutting:** `cut_igcse_islamic.py` runs `edexcel_sciences/cut_pearson.py --extracts` (a long answer is cut at its
  marks) with patches here only: the control character Pearson sets before each label and the mirrored marks
  (")12(") read as typeset; each (d) starts at its passage above the label; a scheme row carried over a page runs to
  its column rules' foot (June 2023 2(b) and 4(a)); the levels grid's "0" is not a label; the company notice under the
  last scheme table is left out; the 2024 and 2025 reports' ligature glyphs ("QuesƟon") are spelt out.
- **Topics:** the specification's 27 numbered subject content items, 1.1 to 3.9, in its three sections. Tagged by
  hand (`tags_igcse_islamic.json`, rules in `tag.md`); every topic has at least three parts.
