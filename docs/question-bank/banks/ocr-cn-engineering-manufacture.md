# OCR Cambridge National in Engineering Manufacture

Added 2 November 2026, after a student asked for it on the Plumi Discord:
`/question-bank/ocr-cn-engineering-manufacture`, every question from the exam unit of OCR's Level
1/Level 2 Cambridge National in Engineering Manufacture (J823), R014 Principles of engineering
manufacture, that OCR publishes on ocr.org.uk: January 2024, June 2024, January 2025 and June 2025,
plus the sample assessment material ("Specimen"). That is 163 parts from 5 papers, every one with
its own mark scheme crop and tagged to a topic, and 136 with the examiner's comments on its question
(the sample paper has none, and OCR comments on only some Section A questions).

- **Level:** a vocational Level 1/Level 2 qualification sat beside GCSE, so its bank has a `level` of
  its own, `"Level 1/2"`, shelved with GCSE ("GCSE & IGCSE") on the hub and listed after IGCSE on
  the homepage's index. `bankTitle` gives "OCR Level 1/2 Engineering Manufacture", and `fullName`
  gives "Cambridge National in Engineering Manufacture" in the bank page's lead. A `note` says R015
  and R016 are coursework and that OCR keeps its 2023 papers on Teach Cambridge.
- **Left out:** R015 and R016 (NEA, no papers); the 2023 series (on Teach Cambridge only; OCR lists
  only its moderators' report); the modified papers. The older Engineering Manufacture (J832/J842,
  unit R109) page on ocr.org.uk no longer lists any papers.
- **Topics:** R014's four topic areas as sections, with 1.2 (manufacturing processes) and 2.3
  (materials) taken to the specification's own sub-headings: 20 topics, 1.1 Types of manufacturing
  processes to 4.3 Globalisation.
- **Papers:** each is 70 marks: Section A is ten multiple-choice questions with options "(a)" to
  "(d)", Section B six structured questions. `cut_ocr_cn_engineering.py` runs
  `ocr_gcse_cs/cut_ocr_gcse_cs.py` (and through it `cut_ocr_cs.py` and `cut_pearson.py`, all
  unchanged) with R014 patches: no part labels above "Section B", so the options stay in their
  question, and each multiple-choice question carries its letter as `k` (upper case, for the answer
  buttons: 50 of 50); sub-part labels set past the scheme's "Question" header (January and June
  2024); a table's marks set level with the margin one (January 2025 13(a), 6 marks); a mark at the
  page's foot, level with "Turn over", kept whole; and a first sub-part's own line kept where it has
  no word of three letters ("(i) AF", January 2025 16(a)(i)). Every paper's parts add up to 70.
