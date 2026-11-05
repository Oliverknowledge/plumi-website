# AQA A-Level German

Added 3 November 2026: `/question-bank/aqa-a-level-german`, every question from AQA's A-Level German
(7662) Papers 1 and 2 that AQA still publishes, November 2020, November 2021 and June 2022 to June
2025, with the AS papers (7661: November 2020, then June 2022 on) marked AS. 843 parts from 22 papers.
Every part has its mark scheme cropped, 185 listening parts play AQA's own recording, and 363 parts
have the examiner's comments. It runs on the French and Spanish pipeline (`aqa_languages/`); German
has a work dir of its own, `.work/aqa-german`, and `fetch_languages.py` takes `--lang=german`.

- **Topics:** the specification's four themes and twelve sub-themes, each passage placed by hand in
  `tag_languages.py`, the skills, and the sixteen set works in Paper 2 (ten texts, six films).
- **Where German differs from French and Spanish** (all in `cut_languages.py`, behind `GERMAN`, so
  a French or Spanish re-cut is unchanged):
  - A gap-fill's, a translation's or a reading summary's marks are printed above its passage, so
    a whole question ends at its last line of text, not its last marks. A part still ends at its
    marks, except A-Level June 2024's 07.1, whose word list is under them.
  - Translations are labelled "Qu 10" on one line. Their general guidance has a page of its own and
    stays out of the crops.
  - AS Paper 2's table is headed "Question", with the label centred far down a merged cell. A summary's
    label is centred far down too, so a row's header is looked for back to the previous label.
  - The guidance can start under a section's last row, on the row's own page: the row stops there.
- **Shared changes:** the essay grids now keep the last line of the AO3 page and leave out the AO4
  page's running header. French and Spanish would pick this up on a re-cut. `audio_languages.py`
  reads a passage length in digits ("1 minute and 26 seconds") as well as words.
- **Listening:** November 2020 (A-Level and AS) has only an untracked recording, cut at the silence
  nearest each passage's printed length; each piece runs 9 to 20 seconds over its printed length,
  which fits the spoken introductions.
- **Reports** head Paper 1's questions "Question 1 – Title". Paper 2's are prose, so an essay gets the
  paragraphs that name its question ("Q10.1") or its work; many works get no comment because the
  report doesn't discuss them. No reports are published for November 2020, November 2021 or AS June 2024.
- **Checked:** every printed line of each question paper was matched against the crops. The only lines
  left out are AQA's acknowledgement notices, section labels, the essay-plan rubric, and one instruction
  in A-Level June 2023 ("Beantworten Sie nun...", above 06.5).
- **Gaps:** June 2017 to June 2019 aren't on AQA's site, and AS has no November 2021 paper. Paper 3
  (speaking) has no written questions, and the specimen papers are left out, as in French and Spanish.
  The past-paper library (`pastPapers.json`) has no German entry, so there is no library page to link.

```bash
python3 scripts/question-bank/aqa_languages/fetch_languages.py scripts/question-bank/.work/aqa-german --lang=german
python3 scripts/question-bank/aqa_languages/audio_languages.py scripts/question-bank/.work/aqa-german
python3 scripts/question-bank/aqa_languages/cut_languages.py scripts/question-bank/.work/aqa-german
python3 scripts/question-bank/aqa_languages/tag_languages.py scripts/question-bank/.work/aqa-german
python3 scripts/question-bank/aqa_languages/build_languages.py scripts/question-bank/.work/aqa-german
python3 scripts/question-bank/upload_r2.py scripts/question-bank/.work/aqa-german
```
