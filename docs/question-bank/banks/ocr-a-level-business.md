# OCR A-Level Business

Added 3 November 2026: `/question-bank/ocr-a-level-business`, every question from OCR's A-Level
(H431) and AS (H031) Business papers that OCR publishes: A-Level November 2021 and June 2022 to
June 2025, AS June 2022 to June 2025. That is 385 parts from 23 papers, every one with its marks,
a topic and a mark scheme crop. Marks add up to the printed total on all 23 (80 at A-Level, 60 at AS).

- **Papers:** H431/01 "Operating in a local business environment" and H031/01 "The local business
  environment" are fifteen multiple-choice questions, then Section B on the Resource Booklet.
  H431/02 "The UK business environment" and H031/02 "The wider business environment" are Section A
  short answers, then Section B on the booklet. H431/03 "The global business environment" is all
  on the booklet. Parts: H431/01 107, /02 74, /03 59; H031/01 91, /02 54.
- **Multiple choice:** 135 questions (nine papers × 15) with their letter (`k`), read from the
  scheme's Answer column and checked against each row. OCR prints the options "(a)" to "(d)" and
  keys them "A" to "D"; the site's buttons say A to D. The scheme's rationale for each is also cut
  (`ms`), though the site shows only the letter for a `k` part today.
- **Topics:** the specification's 105 Content headings under 8 areas. It prints no numbers, so
  the codes are the bank's own ("5.5", ref ""). AS uses the same headings. 97 have questions; the
  8 empty ones have no topic page's worth (the four "strategy" and "external influences" catch-alls
  among them). 10 parts were corrected against the full specification text (`tag/overrides.json`):
  price, income and cross elasticity sit under "Price", normal distribution and standard deviation
  under "Identifying customer needs", outsourcing under "Location and logistics".
- **Case studies:** 181 parts are set on the Resource Booklet, printed apart. They carry `src`, and
  the booklet is `ins` in `wholes`, so each links to the PDF. A question with no parts also has
  the whole case study as its stem, shown on request (`h43101-jun24-stem.webp`). The site opens
  a question-with-parts' stem by itself, with no way to shut it, so those stems stay the question's
  own opening words and the case study is behind the link.
- **Reports:** 155 parts on 133 questions. The A-Level's report sets start June 2022; the AS has
  one for June 2024 only. Sentences pointing at a candidate's script ("see Exemplar 1") are removed,
  as the scripts aren't shown. June 2025's H431/01 report heads several multiple-choice questions
  over a chart with no words: those have no report.

**Cutting (`ocr_business/cut_ocr_business.py`):** `ocr_gcse_economics/cut_ocr_gcse_economics.py` for the
question papers, patched for this run: options aren't parts on questions 1 to 15 of the /01 papers, and
prompts printed between answer lines ("Advantage", "Disadvantage") stay. The schemes have their own
reader, as the label sits in its own column in five or six ways ("18", "18 a", "18 (a)", "13(a)", "19*
(b)", "8 (b)" with its "(i)" in the next cell). A label is taken only where the question paper has that
part and only in the first column, so "2 marks for a clear definition" in a narrow Answer column isn't
question 2. Traps found on the eye check: a row carried to a page opening with "SECTION A" again lost its
last lines; a case study's end can share a page with OCR's copyright notice; H431/03 November 2021 sets
lines across its rules.

**Gaps:**
- OCR's public page lists nothing before November 2021. Earlier sittings are on Teach Cambridge, its
  login site, and aren't fetched. No mirror (PMT or other).
- No reports: A-Level November 2021; AS June 2022, June 2023 and June 2025.
- OCR's own booklets have items removed for third-party copyright, shown as OCR's notice: H031/01 June 2025
  (Extracts A to D and Fig. 1), H031/02 June 2022 to June 2025, H431/02 June 2025 (Extracts B to D and a
  table), H431/03 June 2024 (Extract E) and June 2025 (Extract D). OCR's modified papers (zips) are left out.
- There's no past paper library page for Business yet, so the credit links to `/past-papers`.

```bash
python3 scripts/question-bank/ocr_business/fetch_ocr_business.py
python3 scripts/question-bank/ocr_business/spec_ocr_business.py
python3 scripts/question-bank/ocr_business/cut_ocr_business.py
python3 scripts/question-bank/ocr_business/tag_ocr_business.py split   # tag the batches, then:
python3 scripts/question-bank/ocr_business/tag_ocr_business.py merge
python3 scripts/question-bank/ocr_business/build_ocr_business.py
ln -sfn ../img scripts/question-bank/.work/ocr-business/r2/img
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/ocr-business/r2 --pdf-prefix=ocr/
npm run bank:data -- ocr-a-level-business --verify
```
