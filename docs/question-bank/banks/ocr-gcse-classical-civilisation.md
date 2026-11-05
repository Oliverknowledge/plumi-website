# OCR GCSE Classical Civilisation

Added 3 November 2026: `/question-bank/ocr-gcse-classical-civilisation`, every question from OCR's
GCSE (9-1) Classical Civilisation (J199) that OCR publishes on ocr.org.uk with its mark scheme:
November 2021 and June 2022 to June 2025. That is 713 parts from 23 papers, every one with its own
mark scheme crop, its sources or instructions as a stem, and a topic, and 411 questions with the
examiner's comments (November 2021 has no reports).

- **Options:** a student sits one thematic study (J199/11 Myth and Religion, J199/12 Women in the
  Ancient World) and one literature and culture component (J199/21 The Homeric World, J199/22 Roman
  City Life, J199/23 War and Warfare). Each is a paper, and the filter offers the six pairs
  (`takes`), so a student sees only the two they sit.
- **Topics:** the specification's key topics, eight per component (40). The specification gives them
  no numbers, so their codes are the bank's own and aren't shown. "Themes", which two components
  share, became "Themes of the Odyssey" and "Themes of war literature".
- **Sources:** printed in a separate Insert. Each source is read from its caption to the next, and a
  question's stem is every source its "Study Source A" heading and its own words name, literature's
  two translations (Rieu and Kline) both kept. The 15-mark essays show their instructions instead.
- **Schemes:** 8-mark and 15-mark rows end with the scheme's levels grid for that mark, however the
  scheme lays them out (it can print one grid once, for two essays). June 2022 Myth and Religion's
  scheme prints no grids.
- **Cutting:** `cut_ocr_gcse_classics.py` runs `ocr_gcse_geography/cut_ocr_gcse_geography.py`
  unchanged, with J199 patches. A part ends at its marks and long runs of answer lines are left out.
  Every paper's marks were checked against its printed total (90, plus each alternative essay).
- **Erratum:** June 2022 Women's Question 14 prints "Source D"; OCR's erratum makes it Source E. Its
  stem shows the notice and Source E.
- **Gaps:** June 2018, June 2019 and November 2020 are on Teach Cambridge only. June 2025's Roman
  City Life and War and Warfare are left out: OCR's mark scheme links serve June 2024's schemes.
  The modified papers and sample assessment materials are left out. No past paper library page yet;
  the whole papers are on R2 under `ocr/OCR-J199-*`.
- **Removed sources:** OCR's published Inserts have some sources removed for copyright, printing a
  notice instead, and its modified papers are redacted too. 27 parts show that notice in place of
  their source: June 2025 Myth and Religion's I and J, Women's A and F, The Homeric World's D, E and
  F, June 2024 Roman City Life's E, and November 2021 War and Warfare's A.

```bash
python3 scripts/question-bank/ocr_gcse_classics/fetch_ocr_gcse_classics.py
python3 scripts/question-bank/ocr_gcse_classics/spec_ocr_gcse_classics.py
python3 scripts/question-bank/ocr_gcse_classics/cut_ocr_gcse_classics.py
python3 scripts/question-bank/ocr_gcse_classics/tag_ocr_gcse_classics.py split   # then tag each batch (tag.md)
python3 scripts/question-bank/ocr_gcse_classics/tag_ocr_gcse_classics.py merge
python3 scripts/question-bank/ocr_gcse_classics/build_ocr_gcse_classics.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-classics/r2 --pdf-prefix=ocr/
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-gcse-classics --crops-only
```
