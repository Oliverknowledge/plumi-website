# AQA GCSE English Literature

Added 27 October 2026, the bank's first essay-on-set-texts subject:
`/question-bank/aqa-gcse-english-literature`, every question from AQA's GCSE English
Literature (8702) papers that AQA still publishes, November 2020 to June 2025. That is 247
questions from 16 papers, every one with its mark scheme cropped and 233 with the
examiner's comments.

- **Topics are the set texts.** A paper asks a question (two, for a modern text) on every
  set text, and a student answers only on the texts they studied, so the bank's topics
  are the texts ("Macbeth", "An Inspector Calls", "Power and conflict", "Unseen poetry")
  under the specification's sections (Shakespeare, the 19th-century novel, modern prose or
  drama, the poetry anthology, unseen poetry). Each question is tagged from its heading in
  the mark scheme or the paper (`aqa_english_lit/texts.py`), so there is no tagging pass.
  Only texts AQA has set a question on since 2020 are listed (the 2025 texts Princess &
  The Hustler, Leave Taking, My Name Is Leon and the Worlds and lives cluster included).
- **Whole questions, extract included.** Answers go in a separate answer book, so a
  question runs from its label to the next "or", heading or label: the extract printed
  under a Shakespeare or novel question's label, the question printed again under it, the
  named poem printed after an anthology question. An unseen question's poem comes before
  its label, so 27.1 runs from the section's start and 27.2 from the end of 27.1; the two
  show as one question. No stems. Ids are `87021-jun24-01`, `87022-jun24-27-1`.
- **Either/or.** In each section every question after the first carries `or`, so a
  paper's marks count the one question a student answers (both unseen questions count).
  A question's marks include its AO4 marks (30 + 4), so every paper adds up to its front
  cover's maximum: 64 for Paper 1, 96 for Paper 2.
- **2021–22.** In November 2021 and June 2022 Paper 1 was sat as three 30-mark papers, one
  a section (1M modern prose or drama, 1N the novel, 1P the anthology: components
  `87021M`, `87021N`, `87021P`), and Paper 2 (70 marks) was Shakespeare and unseen poetry.
  They are separate papers in the filter; the June 2024 Paper 2 is AQA's "8702/2R".
- **Mark schemes:** each question's own page (the question and its indicative content),
  then the section's levels grid (landscape, printed once per section) and, for an AO4
  question, the AO4 descriptors, stacked into one crop. The 8-mark unseen comparison has
  its own grid on its page and takes no other.
- **Reports** go section by section, a paragraph or two a text: a question gets its
  section's paragraphs that name its text, else the section's general paragraphs; the
  2021–22 1P report heads each question, and is used as is. The November 2021 1M report
  names only some texts, so 14 of its questions have no report.
- **Search** covers the whole extract, so searching a quotation finds its question.
- **Pipeline:** `scripts/question-bank/aqa_english_lit/`: `fetch_english_lit.py` (fetch_aqa.py
  over 8702), `texts.py`, `cut_english_lit.py` (its own layout around cut.py's label finder
  and image helpers; cut.py is unchanged) and `build_english_lit.py`. Papers are on R2
  under `aqa/AQA-8702*`, crops under `bank/8702*`.
- **Gaps:** AQA no longer publishes June 2017–2019 (its file store has none), so the bank
  starts at November 2020; the specimen papers are left out. AQA's own copies withhold some
  poems for copyright, and those crops show AQA's note in place of the poem: the unseen
  poems of June 2023 (both), June 2025 (the first, 'Table') and November 2020 (the second), and June
  2022 1P's 'Bayonet Charge'. The questions are all there.

```bash
python3 scripts/question-bank/aqa_english_lit/fetch_english_lit.py gcse
python3 scripts/question-bank/aqa_english_lit/cut_english_lit.py
python3 scripts/question-bank/aqa_english_lit/build_english_lit.py
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lit-gcse
```
