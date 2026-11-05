# AQA A-Level English Language

Added 1 November 2026: `/question-bank/aqa-a-level-english-language`, every question from
AQA's A-Level English Language (7702) Paper 1 (Language, the individual and society) and
Paper 2 (Language diversity and change) that AQA still publishes, November 2020 to June 2025.
That is 44 questions from 12 papers (Paper 1: 26; Paper 2: 18), every one with its mark scheme
cropped, 21 with the examiner's comments. The NEA (coursework) has no paper.

- **Topics are the question types,** as at GCSE: Paper 1 Q1 and Q2 analysing Text A and Text B
  (AO1, AO3), Q3 comparing them (AO4), Q4 spoken language development (AO1, AO2), Q5 literacy
  development (AO1, AO2); Paper 2 Q1 language diversity and Q2 language change essays (AO1, AO2),
  Q3 analysing two texts' views on language (AO1, AO3, AO4), Q4 writing an opinion article
  (AO2, AO5). Tagged by number, no tagging pass.
- **The texts.** Paper 1 Section A and Paper 2 Section B read two texts printed in an insert. Those
  questions share a stem ("how question 01 starts"): the section's introduction (what each text
  is) and the insert's texts, so a student reads them in place. The bank's `wholes` carries the
  insert as `ins`, and a question that names "Text A" shows a "Texts (insert)" link to it
  (QuestionRow's insert test gains "Text A"). Paper 1's child language data (a transcript for
  Q4, children's writing with transliterations for Q5) is printed in the paper under the
  question, and the question's crop carries all of it.
- **Choices:** Paper 1's Q5 is the alternative to Q4, Paper 2's Q2 to Q1 (`or`). Every whole
  paper adds up to 100.
- **Mark schemes:** each question's from its boxed label to the next: every assessment
  objective's levels grid (Level 5 to 0) with its indicative content beside it, two or three
  pages each. The schemes' header and footer rules alternate between the left and right edge,
  so the cutter uses the GCSE English Language scheme frame, which drops both.
- **Reports** (June 2022, 2023 and 2025 only; AQA publishes none for November 2020, November 2021
  or June 2024) head each question ("Question 1", "Question 3 – AO4"). A question gets
  everything under its heading up to the next question, section or closing section.
- **Pipeline:** `scripts/question-bank/aqa_english_lang/`: `fetch_english_lang.py a-level`
  (fetch_aqa.py over 7702), `cut_english_lang_a.py` (cut_english_lit.py's A-Level paper reader,
  scheme reader and insert reader; Literature's cutter and cut.py unchanged) and
  `build_english_lang.py --level=a`. Papers are on R2 under `aqa/AQA-7702*`, crops under
  `bank/7702*`.
- **Gaps:** AQA no longer publishes June 2017 to June 2019 (its file store answers "not found"),
  so the bank starts at November 2020. AQA's copyright-removed inserts blank out some texts,
  and the questions that read them are left out: Paper 1 June 2022 Text B (Q2, Q3) and June 2024
  Text A (Q1, Q3); Paper 2 November 2020 Text B, June 2022 both texts and June 2023 Text A (Q3,
  Q4 each time). June 2023 Paper 1's Text A only blanks a photo, so its questions stay. The
  specimen papers are left out, as in the other AQA banks.

```bash
python3 scripts/question-bank/aqa_english_lang/fetch_english_lang.py a-level
python3 scripts/question-bank/aqa_english_lang/cut_english_lang_a.py
python3 scripts/question-bank/aqa_english_lang/build_english_lang.py --level=a
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-english-lang-a
```
