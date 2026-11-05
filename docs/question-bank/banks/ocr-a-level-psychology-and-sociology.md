# OCR A-Level Psychology and Sociology

Banks: `ocr-a-level-psychology`, `ocr-a-level-sociology`

Added 1 November 2026: `/question-bank/ocr-a-level-psychology` and `/question-bank/ocr-a-level-sociology`,
every question from the OCR A-Level Psychology (H567, Papers 1–3) and Sociology (H580, Papers 1–3)
papers OCR publishes on its own site: November 2021 and June 2022 to June 2025. The series before
(2017 to 2020) are on Teach Cambridge, OCR's teacher login, only. Psychology is 399 questions and
parts from 15 papers, Sociology 150 questions from 15 papers. Every question has its mark scheme
cropped (Psychology Paper 1's multiple choice has its answer letter), every series but November 2021
its examiner's comments, and every paper adds up to OCR's total (90, 105, 105), counting the options a
student answers. Scripts in `scripts/question-bank/ocr_psychology/` and `ocr_sociology/`; the cutting
is `ocr_economics/cut_ocr_economics.py`, unchanged, with `ocr_sociology/cut_ocr_sociology.py` on top.

- **Options.** Sociology Paper 1 (families and relationships, youth subcultures, media) and Paper 3
  (crime and deviance, education, religion, belief and faith) and Psychology Paper 3 (child, criminal,
  environmental, sport and exercise) print each option under an "OPTION 1" heading. Each option's
  questions are a paper of their own, "Paper 3 (Child psychology)" (`h56703chi`), carrying its
  `option`, so the Option filter and the multi-paper filter both pick a student's; the option's topics
  are in a section with that `option`. Every option paper links the whole paper.
- **Sources as stems.** Sociology's source questions (Papers 1–3, Section A) are named for their
  block, `h58002-jun24-e1-03`, sharing `h58002-jun24-e1-stem.webp`. Psychology Paper 1's Sections B
  and C open with a study and its data: whole questions are named for the block, a question with
  parts has its own stem (the block and its own opening words).
- **Sources OCR left out.** Where OCR removed a source for copyright (a black box and a red line),
  the box is painted out and closed up to a line saying the source isn't in OCR's published paper,
  under the source's heading: Sociology Paper 1 and Paper 2 June 2024, Psychology Paper 2's article
  June 2024 and June 2025.
- **Mark schemes.** Most long answers' rows say "PLEASE REFER TO APPENDIX 3": the levels grid is at
  the scheme's back, once per kind of question. Each crop takes the appendix it names, after its own
  indicative content, and no crop runs on into the appendices.
